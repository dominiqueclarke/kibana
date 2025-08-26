/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { type Observable, of, from, switchMap } from 'rxjs';
import type { KibanaRequest } from '@kbn/core/server';
import {
  type ToolCall,
  type AssistantMessage,
  type ToolMessage,
  MessageRole,
} from '@kbn/inference-common';
import type { SuggestionHandler } from '../../../attachment_framework/types';
import type { SuggestionItem, SuggestionContext } from '../../../../common/types/domain';

export const callChooseSuggestionTool = ({
  toolCall,
  toolHandlers,
  pendingSuggestions,
  context,
  request,
}: {
  toolCall: ToolCall;
  toolHandlers: Record<string, SuggestionHandler>;
  pendingSuggestions: Map<string, SuggestionItem>;
  context: SuggestionContext;
  request: KibanaRequest;
}): Observable<ToolMessage<string, SuggestionItem[]> | AssistantMessage> => {
  const toolCallId = toolCall.toolCallId;
  const toolName = toolCall.function.name;

  return from(toolHandlers[toolName]?.({ context, request })).pipe(
    switchMap((handlerResponse) => {
      handlerResponse.suggestions.forEach((suggestion) => {
        const suggestionId = suggestion.id ?? '';
        pendingSuggestions.set(suggestionId, suggestion);
      });

      const toolMessage: ToolMessage<string, SuggestionItem[]> = {
        name: toolName,
        role: MessageRole.Tool,
        toolCallId,
        response: handlerResponse.suggestions,
      };
      return of(toolMessage);
    })
  );
};
