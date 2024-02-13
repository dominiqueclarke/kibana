/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { decodeOrThrow, jsonRt } from '@kbn/io-ts-utils';
import { Logger } from '@kbn/logging';
import type { Serializable } from '@kbn/utility-types';
import dedent from 'dedent';
import { encode } from 'gpt-tokenizer';
import * as t from 'io-ts';
import { compact, last, omit } from 'lodash';
import { lastValueFrom, Observable } from 'rxjs';
import { FunctionRegistrationParameters } from '.';
import { MessageAddEvent } from '../../common/conversation_complete';
import { FunctionVisibility, MessageRole, type Message } from '../../common/types';
import { concatenateChatCompletionChunks } from '../../common/utils/concatenate_chat_completion_chunks';
import type { ObservabilityAIAssistantClient } from '../service/client';
import { createFunctionResponseMessage } from '../service/util/create_function_response_message';

const MAX_TOKEN_COUNT_FOR_DATA_ON_SCREEN = 1000;

export function registerContextFunction({
  client,
  registerFunction,
  resources,
  isKnowledgeBaseAvailable,
}: FunctionRegistrationParameters & { isKnowledgeBaseAvailable: boolean }) {
  registerFunction(
    {
      name: 'context',
      contexts: ['core'],
      description:
        'This function provides context as to what the user is looking at on their screen, and recalled documents from the knowledge base that matches their query',
      visibility: FunctionVisibility.AssistantOnly,
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          queries: {
            type: 'array',
            additionalItems: false,
            additionalProperties: false,
            description: 'The query for the semantic search',
            items: {
              type: 'string',
            },
          },
          categories: {
            type: 'array',
            additionalItems: false,
            additionalProperties: false,
            description:
              'Categories of internal documentation that you want to search for. By default internal documentation will be excluded. Use `apm` to get internal APM documentation, `lens` to get internal Lens documentation, or both.',
            items: {
              type: 'string',
              enum: ['apm', 'lens'],
            },
          },
        },
        required: ['queries', 'categories'],
      } as const,
    },
    async ({ arguments: args, messages, connectorId, appContexts }, signal) => {
      const { queries, categories } = args;

      async function getContext() {
        const systemMessage = messages.find(
          (message) => message.message.role === MessageRole.System
        );

        const screenDescription = appContexts.map((context) => context.description).join('\n\n');
        // any data that falls within the token limit, send it automatically

        const dataWithinTokenLimit = compact(appContexts.flatMap((context) => context.data)).filter(
          (data) => encode(JSON.stringify(data.value)).length <= MAX_TOKEN_COUNT_FOR_DATA_ON_SCREEN
        );

        const content = {
          screen_description: screenDescription,
          learnings: [],
          ...(dataWithinTokenLimit.length ? { data_on_screen: dataWithinTokenLimit } : {}),
        };

        if (!isKnowledgeBaseAvailable) {
          return { content };
        }

        if (!systemMessage) {
          throw new Error('No system message found');
        }

        const userMessage = last(
          messages.filter((message) => message.message.role === MessageRole.User)
        );

        const nonEmptyQueries = compact(queries);

        const queriesOrUserPrompt = nonEmptyQueries.length
          ? nonEmptyQueries
          : compact([userMessage?.message.content]);

        queriesOrUserPrompt.push(screenDescription);

        const suggestions = await retrieveSuggestions({
          userMessage,
          client,
          categories,
          queries: queriesOrUserPrompt,
        });

        if (suggestions.length === 0) {
          return {
            content,
          };
        }

        const relevantDocuments = await scoreSuggestions({
          suggestions,
          queries: queriesOrUserPrompt,
          messages,
          client,
          connectorId,
          signal,
          logger: resources.logger,
        });

        return {
          content: { ...content, learnings: relevantDocuments as unknown as Serializable },
        };
      }

      return new Observable<MessageAddEvent>((subscriber) => {
        getContext()
          .then(({ content }) => {
            subscriber.next(
              createFunctionResponseMessage({
                name: 'context',
                content,
              })
            );

            subscriber.complete();
          })
          .catch((error) => {
            subscriber.error(error);
          });
      });
    }
  );
}

async function retrieveSuggestions({
  queries,
  client,
  categories,
}: {
  userMessage?: Message;
  queries: string[];
  client: ObservabilityAIAssistantClient;
  categories: Array<'apm' | 'lens'>;
}) {
  const recallResponse = await client.recall({
    queries,
    categories,
  });

  return recallResponse.entries.map((entry) => omit(entry, 'labels', 'is_correction', 'score'));
}

const scoreFunctionRequestRt = t.type({
  message: t.type({
    function_call: t.type({
      name: t.literal('score'),
      arguments: t.string,
    }),
  }),
});

const scoreFunctionArgumentsRt = t.type({
  scores: t.string,
});

async function scoreSuggestions({
  suggestions,
  messages,
  queries,
  client,
  connectorId,
  signal,
  logger,
}: {
  suggestions: Awaited<ReturnType<typeof retrieveSuggestions>>;
  messages: Message[];
  queries: string[];
  client: ObservabilityAIAssistantClient;
  connectorId: string;
  signal: AbortSignal;
  logger: Logger;
}) {
  const indexedSuggestions = suggestions.map((suggestion, index) => ({ ...suggestion, id: index }));

  const newUserMessageContent =
    dedent(`Given the following question, score the documents that are relevant to the question. on a scale from 0 to 7,
    0 being completely relevant, and 7 being extremely relevant. Information is relevant to the question if it helps in
    answering the question. Judge it according to the following criteria:

    - The document is relevant to the question, and the rest of the conversation
    - The document has information relevant to the question that is not mentioned,
      or more detailed than what is available in the conversation
    - The document has a high amount of information relevant to the question compared to other documents
    - The document contains new information not mentioned before in the conversation

    Question:
    ${queries.join('\n')}

    Documents:
    ${JSON.stringify(indexedSuggestions, null, 2)}`);

  const newUserMessage: Message = {
    '@timestamp': new Date().toISOString(),
    message: {
      role: MessageRole.User,
      content: newUserMessageContent,
    },
  };

  const scoreFunction = {
    name: 'score',
    description:
      'Use this function to score documents based on how relevant they are to the conversation.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        scores: {
          description: `The document IDs and their scores, as CSV. Example:
          
            my_id,7
            my_other_id,3
            my_third_id,4
          `,
          type: 'string',
        },
      },
      required: ['score'],
    } as const,
    contexts: ['core'],
  };

  const response = await lastValueFrom(
    (
      await client.chat('score_suggestions', {
        connectorId,
        messages: [...messages.slice(0, -1), newUserMessage],
        functions: [scoreFunction],
        functionCall: 'score',
        signal,
      })
    ).pipe(concatenateChatCompletionChunks())
  );

  const scoreFunctionRequest = decodeOrThrow(scoreFunctionRequestRt)(response);
  const { scores: scoresAsString } = decodeOrThrow(jsonRt.pipe(scoreFunctionArgumentsRt))(
    scoreFunctionRequest.message.function_call.arguments
  );

  const scores = scoresAsString.split('\n').map((line) => {
    const [index, score] = line
      .split(',')
      .map((value) => value.trim())
      .map(Number);

    return { id: suggestions[index].id, score };
  });

  if (scores.length === 0) {
    return [];
  }

  const suggestionIds = suggestions.map((document) => document.id);

  const relevantDocumentIds = scores
    .filter((document) => suggestionIds.includes(document.id)) // Remove hallucinated documents
    .filter((document) => document.score > 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((document) => document.id);

  const relevantDocuments = suggestions.filter((suggestion) =>
    relevantDocumentIds.includes(suggestion.id)
  );

  logger.debug(`Relevant documents: ${JSON.stringify(relevantDocuments, null, 2)}`);

  return relevantDocuments;
}
