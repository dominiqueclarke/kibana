/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ToolCallsOf } from '@kbn/inference-common';
import type { EvaluationToolKey } from '../../../../common/types/api';
import type { EVALUATION_TOOLS } from './tools';

export type CaseSuggestionToolRequest<TToolName extends EvaluationToolKey = EvaluationToolKey> =
  ToolCallsOf<{
    tools: Pick<typeof EVALUATION_TOOLS, TToolName>;
  }>['toolCalls'][number];
