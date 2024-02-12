/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { FromSchema } from 'json-schema-to-ts';
import type {
  CompatibleJSONSchema,
  FunctionDefinition,
  FunctionResponse,
  Message,
  ObservabilityAIAssistantAppContext,
  RegisterContextDefinition,
} from '../../common/types';
import type { ObservabilityAIAssistantRouteHandlerResources } from '../routes/types';
import { ChatFunctionClient } from './chat_function_client';
import type { ObservabilityAIAssistantClient } from './client';

export type RespondFunctionResources = Pick<
  ObservabilityAIAssistantRouteHandlerResources,
  'context' | 'logger' | 'plugins' | 'request'
>;

type RespondFunction<TArguments, TResponse extends FunctionResponse> = (
  options: {
    arguments: TArguments;
    messages: Message[];
    connectorId: string;
    appContexts: ObservabilityAIAssistantAppContext[];
  },
  signal: AbortSignal
) => Promise<TResponse>;

export interface FunctionHandler {
  definition: FunctionDefinition;
  respond: RespondFunction<any, FunctionResponse>;
}

export type RegisterFunction = <
  TParameters extends CompatibleJSONSchema = any,
  TResponse extends FunctionResponse = any,
  TArguments = FromSchema<TParameters>
>(
  definition: FunctionDefinition<TParameters>,
  respond: RespondFunction<TArguments, TResponse>
) => void;
export type FunctionHandlerRegistry = Map<string, FunctionHandler>;

export type ChatRegistrationFunction = ({}: {
  signal: AbortSignal;
  resources: RespondFunctionResources;
  client: ObservabilityAIAssistantClient;
  registerFunction: RegisterFunction;
  registerContext: RegisterContextDefinition;
  hasFunction: ChatFunctionClient['hasFunction'];
}) => Promise<void>;

export interface ObservabilityAIAssistantResourceNames {
  componentTemplate: {
    conversations: string;
    kb: string;
  };
  indexTemplate: {
    conversations: string;
    kb: string;
  };
  aliases: {
    conversations: string;
    kb: string;
  };
  indexPatterns: {
    conversations: string;
    kb: string;
  };
  pipelines: {
    kb: string;
  };
}
