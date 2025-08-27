/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { type Observable, of } from 'rxjs';
import { type ToolCall, type AssistantMessage, MessageRole } from '@kbn/inference-common';
import type { SuggestionItem } from '../../../../common/types/domain';
import {
  type AnalyzeSuggestionsToolMessage,
  ANALYZE_SUGGESTION_TOOL_NAME,
} from '../../../../common/types/api';

export const callAnalyzeSuggestionTool = ({
  toolCall,
  finalSuggestions,
  pendingSuggestions,
  reviewedSuggestions,
}: {
  toolCall: ToolCall;
  finalSuggestions: Map<string, SuggestionItem>;
  pendingSuggestions: Map<string, SuggestionItem>;
  reviewedSuggestions: Map<string, SuggestionItem>;
}): Observable<AnalyzeSuggestionsToolMessage | AssistantMessage> => {
  const toolCallId = toolCall.toolCallId;
  const toolName = toolCall.function.name;

  if (!('arguments' in toolCall.function)) {
    const errorMessage: AssistantMessage = {
      role: MessageRole.Assistant,
      content: `Tool call function for ${toolName} does not have arguments.`,
    };
    return of(errorMessage);
  }

  const toolArguments = toolCall.function.arguments;

  const isRelevant = toolArguments.isRelevant;
  const suggestionId = toolArguments.suggestionId;

  if (isRelevant === undefined) {
    const errorMessage: AssistantMessage = {
      role: MessageRole.Assistant,
      content: `No suggestions available for tool ${toolName}.`,
    };
    return of(errorMessage);
  }

  const suggestion = pendingSuggestions.get(suggestionId);

  if (isRelevant === false) {
    const toolMessage: AnalyzeSuggestionsToolMessage = {
      name: ANALYZE_SUGGESTION_TOOL_NAME,
      role: MessageRole.Tool,
      toolCallId,
      response: {
        approvedSuggestions: [],
        deninedSuggestions: suggestion ? [suggestion] : [],
      },
    };
    pendingSuggestions.delete(suggestionId);
    return of(toolMessage);
  }

  if (isRelevant) {
    const approvedSuggestion = suggestion;
    if (!approvedSuggestion) {
      const errorMessage: AssistantMessage = {
        role: MessageRole.Assistant,
        content: `Suggestion with id ${suggestionId} not found in pending suggestions.`,
      };
      return of(errorMessage);
    }
    finalSuggestions.set(suggestionId, approvedSuggestion);
  }

  if (suggestion) {
    reviewedSuggestions.set(suggestionId, suggestion);
  }
  pendingSuggestions.delete(suggestionId);

  const toolMessage: AnalyzeSuggestionsToolMessage = {
    name: ANALYZE_SUGGESTION_TOOL_NAME,
    role: MessageRole.Tool,
    toolCallId,
    response: {
      approvedSuggestions: Array.from(finalSuggestions.values()),
      deninedSuggestions: [],
    },
  };
  return of(toolMessage);
};
