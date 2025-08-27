/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import dedent from 'dedent';
import type { KibanaRequest } from '@kbn/core/server';
import { MessageRole, ToolChoiceType } from '@kbn/inference-common';
import type { ToolDefinition, InferenceClient, AssistantMessage } from '@kbn/inference-common';
import type { Logger } from '@kbn/logging';
import { pick } from 'lodash';
import { catchError, filter, map, mergeMap, type Observable, of, switchMap } from 'rxjs';
import type { AttachmentSuggestionRegistry } from '../../../attachment_framework/suggestion_registry';
import type {
  SuggestionItem,
  SuggestionContext,
  SuggestionOwner,
} from '../../../../common/types/domain';
import { EVALUATION_TOOLS } from './tools';
import { callTools } from './util/call_tools';
import { getSystemPrompt, buildCaseContextPrompt } from './prompts';
import {
  type ToolErrorMessage,
  type SuggestionEvent,
  type AnalyzeSuggestionsToolMessage,
  type FinalizeSuggestionsToolMessage,
  type CaseSuggestionHandlerToolMessage,
  ANALYZE_SUGGESTION_TOOL_NAME,
  FINALIZE_SUGGESTIONS_TOOL_NAME,
} from '../../../../common/types/api';
import { callChooseSuggestionTool } from './call_choose_suggestions_tools';
import { callAnalyzeSuggestionTool } from './call_analyze_suggestion_tool';
import { callFinalizeSuggestionsTool } from './call_finalize_suggestions_tool';

export function runCaseSuggestions({
  connectorId,
  context,
  inferenceClient,
  logger: incomingLogger,
  owners,
  prevEvents,
  request,
  suggestionRegistry,
}: {
  connectorId: string;
  context: SuggestionContext;
  inferenceClient: InferenceClient;
  logger: Logger;
  owners: SuggestionOwner[];
  prevEvents?: SuggestionEvent[];
  request: KibanaRequest;
  suggestionRegistry: AttachmentSuggestionRegistry;
}): Observable<SuggestionEvent> {
  const logger = incomingLogger.get('case_suggestions');
  const suggestionTools = suggestionRegistry.getAllToolsForOwners(owners);
  const toolHandlers = suggestionRegistry.getAllHandlersForOwners(owners);
  const primaryOwner = getPrimaryOwner(owners);
  const suggestionToolNames = Object.keys(suggestionTools);
  const reviewedSuggestions: Map<string, SuggestionItem> = new Map();
  const pendingSuggestions: Map<string, SuggestionItem> = new Map();
  const finalSuggestions: Map<string, SuggestionItem> = new Map();

  const CHOOSE_SUGGESTIONS_INSTRUCTIONS = dedent(`
    Your next step is to choose the most relevant suggestion types based on the context of the case. Consider the following factors:
    
    - The specific issues or questions raised in the case
    - The potential impact of each suggestion on the case outcome
    - Any relevant constraints or requirements identified in the case

  Use this information to guide your selection of suggestion types.`);

  const EVALUATE_SUGGESTIONS_INSTRUCTIONS = dedent(`
    Your next step is to evaluate the potential impact of each suggestion on the case outcome. Consider the following factors:

    - The likelihood of each suggestion addressing the identified issues
    - The potential benefits and drawbacks of each suggestion
    - Any relevant constraints or requirements identified in the case
  `);

  const CHOOSE_OR_FINALIZE_INSTRUCTIONS = dedent(`
    Your next step is to choose more suggestions to pursue or end the process and finalize your selections. Consider the following factors:
    - Explore each suggestion type only once. Do not re-evaluate or re-analyze suggestions that have already been considered.
    - Limit the number of returned suggestions to a max of 5. If you have 5 or more relevant suggestions, end the process.

  Use this information to guide your selection of suggestion types.`);

  const initialMessage = {
    role: MessageRole.User as const,
    content: dedent(`
        ${buildCaseContextPrompt(context, primaryOwner)}

        ${CHOOSE_SUGGESTIONS_INSTRUCTIONS}
      `),
  };

  const nextEvents = [initialMessage, ...(prevEvents ?? [])];

  const next$ = callTools(
    {
      system: dedent(getSystemPrompt(primaryOwner)),
      connectorId,
      inferenceClient,
      messages: nextEvents,
      logger,
    },
    ({ messages }) => {
      let nextSystem = getSystemPrompt(primaryOwner);
      const hasPendingSuggestions = pendingSuggestions.size > 0;
      const hasReviewedSuggestions = reviewedSuggestions.size > 0;

      let nextTools: Record<string, ToolDefinition> = {};

      if (!hasReviewedSuggestions && !hasPendingSuggestions) {
        nextSystem += `\n${CHOOSE_SUGGESTIONS_INSTRUCTIONS}`;
        nextTools = {
          ...suggestionTools,
          ...pick(EVALUATION_TOOLS, FINALIZE_SUGGESTIONS_TOOL_NAME),
        };
      } else if (hasReviewedSuggestions && !hasPendingSuggestions) {
        nextSystem += `\n${CHOOSE_OR_FINALIZE_INSTRUCTIONS}`;
        nextTools = pick(EVALUATION_TOOLS, FINALIZE_SUGGESTIONS_TOOL_NAME);
      } else if (hasPendingSuggestions) {
        nextSystem += `\n${EVALUATE_SUGGESTIONS_INSTRUCTIONS}`;
        nextTools = pick(EVALUATION_TOOLS, ANALYZE_SUGGESTION_TOOL_NAME);
      }

      return {
        messages,
        system: nextSystem,
        tools: nextTools,
        toolChoice: hasPendingSuggestions
          ? { function: ANALYZE_SUGGESTION_TOOL_NAME }
          : ToolChoiceType.required,
      };
    },
    ({
      toolCalls,
      messages,
    }): Observable<
      | ToolErrorMessage
      | AnalyzeSuggestionsToolMessage
      | CaseSuggestionHandlerToolMessage
      | FinalizeSuggestionsToolMessage
      | AssistantMessage
    > => {
      return of(undefined).pipe(
        switchMap(() => {
          return of(...toolCalls).pipe(
            mergeMap((toolCall) => {
              function executeToolCall(): Observable<
                | AnalyzeSuggestionsToolMessage
                | FinalizeSuggestionsToolMessage
                | CaseSuggestionHandlerToolMessage
                | ToolErrorMessage
                | AssistantMessage
              > {
                switch (true) {
                  case suggestionToolNames.includes(toolCall.function.name):
                    return callChooseSuggestionTool({
                      pendingSuggestions,
                      toolHandlers,
                      toolCall,
                      context,
                      request,
                    });

                  case toolCall.function.name === ANALYZE_SUGGESTION_TOOL_NAME:
                    return callAnalyzeSuggestionTool({
                      finalSuggestions,
                      pendingSuggestions,
                      reviewedSuggestions,
                      toolCall,
                    });

                  case toolCall.function.name === FINALIZE_SUGGESTIONS_TOOL_NAME:
                    return callFinalizeSuggestionsTool({
                      toolCallId: toolCall.toolCallId,
                      finalSuggestions,
                    });

                  default:
                    return of({
                      name: 'error',
                      role: MessageRole.Tool,
                      response: {
                        error: {
                          message: 'Tool not found',
                        },
                      },
                      toolCallId: toolCall.toolCallId,
                    } as ToolErrorMessage);
                }
              }

              return executeToolCall().pipe(
                catchError((error) => {
                  logger.error(`Failed executing task: ${error.message}`);
                  logger.error(error);
                  const toolErrorMessage: ToolErrorMessage = {
                    name: 'error',
                    role: MessageRole.Tool,
                    response: {
                      error: {
                        ...('toJSON' in error && typeof error.toJSON === 'function'
                          ? error.toJSON()
                          : {}),
                        message: error.message,
                      },
                    },
                    toolCallId: toolCall.toolCallId,
                  };
                  return of(toolErrorMessage);
                })
              );
            })
          );
        })
      );
    }
  );

  return next$.pipe(
    filter((event) =>
      Boolean(event.role !== MessageRole.Assistant || event.content || event.toolCalls?.length)
    ),
    map((event) => {
      if (event.role === MessageRole.Assistant) {
        return event as Extract<SuggestionEvent, AssistantMessage>;
      }
      return event;
    })
  );
}

function getPrimaryOwner(owners: SuggestionOwner[]): SuggestionOwner {
  if (owners.includes('observability')) {
    return 'observability';
  }
  if (owners.includes('securitySolution')) {
    return 'securitySolution';
  }
  return 'cases';
}
