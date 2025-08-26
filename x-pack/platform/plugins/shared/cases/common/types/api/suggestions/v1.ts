/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type {
  ToolMessage,
  UserMessage,
  ToolChoice,
  AssistantMessageOf,
  ToolDefinition,
} from '@kbn/inference-common';
import type { SuggestionItem } from '../../domain';

export interface SuggestionResponse {
  suggestions: Array<SuggestionItem>;
}

export const ANALYZE_SUGGESTION_TOOL_NAME = 'analyzeSuggestionsForCase';
export const FINALIZE_SUGGESTIONS_TOOL_NAME = 'finalizeSuggestionsForCase';

type EvaluationTools = typeof ANALYZE_SUGGESTION_TOOL_NAME | typeof FINALIZE_SUGGESTIONS_TOOL_NAME;

/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

export type FinalizeSuggestionsToolMessage = ToolMessage<
  typeof FINALIZE_SUGGESTIONS_TOOL_NAME,
  {
    suggestions: SuggestionItem[];
  }
>;

export type AnalyzeSuggestionsToolMessage = ToolMessage<
  typeof ANALYZE_SUGGESTION_TOOL_NAME,
  {
    approvedSuggestions: SuggestionItem[];
    deninedSuggestions: SuggestionItem[];
  }
>;

export type CaseSuggestionHandlerToolMessage = ToolMessage<string, SuggestionItem[]>;

export type CaseSuggestionsToolMessage =
  | FinalizeSuggestionsToolMessage
  | AnalyzeSuggestionsToolMessage
  | CaseSuggestionHandlerToolMessage;

export type ToolErrorMessage = ToolMessage<
  'error',
  {
    error: {
      message: string;
    };
  }
>;

export type SuggestionEvent =
  | CaseSuggestionsToolMessage
  | ToolErrorMessage
  | UserMessage
  | AssistantMessageOf<{
      tools: Record<string, ToolDefinition>;
      toolChoice?: ToolChoice<EvaluationTools>;
    }>;
