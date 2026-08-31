/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { isResponseError } from '@kbn/es-errors';
import type { SpanPerfErrorResult } from './types';

interface EsErrorBody {
  error?: {
    type?: string;
    reason?: string;
  };
}

const readErrorBody = (error: { body?: unknown; meta?: { body?: unknown } }): EsErrorBody => {
  if (error.body && typeof error.body === 'object') {
    return error.body as EsErrorBody;
  }
  if (error.meta?.body && typeof error.meta.body === 'object') {
    return error.meta.body as EsErrorBody;
  }
  return {};
};

export const toSpanPerfError = (error: unknown): SpanPerfErrorResult['error'] => {
  if (isResponseError(error)) {
    const body = readErrorBody(error);
    return {
      status_code: error.statusCode ?? null,
      type: body.error?.type ?? null,
      reason: body.error?.reason ?? error.message,
    };
  }

  if (error instanceof Error) {
    return {
      status_code: null,
      type: null,
      reason: error.message,
    };
  }

  return {
    status_code: null,
    type: null,
    reason: String(error),
  };
};
