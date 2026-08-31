/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod/v4';
import { errorResponseSchema, ID_MAX_LENGTH } from '@kbn/alerting-v2-schemas';
import {
  DEFAULT_SEARCH_AFTER_MAX_EVENTS,
  DEFAULT_SEARCH_AFTER_PAGE_SIZE,
} from '../../lib/span_perf/fetch_events_search_after';

export const SPAN_PERF_SEARCH_AFTER_PATH = '/internal/alerting/v2/_span_perf/search_after';
export const SPAN_PERF_TOP_ZIP_PATH = '/internal/alerting/v2/_span_perf/top_zip';
export const SPAN_PERF_ESQL_PATH = '/internal/alerting/v2/_span_perf/esql';
export const SPAN_PERF_VALUES_ZIP_PATH = '/internal/alerting/v2/_span_perf/values_zip';

const statusSpanSchema = z.object({
  episodeId: z.string(),
  ruleId: z.string().nullable(),
  groupHash: z.string().nullable(),
  statusStartedAt: z.string(),
  previousStatus: z.string().nullable(),
  episodeStatus: z.string(),
  durationMs: z.number(),
  statusEndedAt: z.string().nullable(),
});

const timingsSchema = z.object({
  elasticsearch_took_ms: z.number().nullable(),
  elasticsearch_wall_ms: z.number(),
  kibana_ms: z.number(),
  total_ms: z.number(),
  pages: z.number().int().optional(),
});

export const spanPerfSearchAfterRequestSchema = z.object({
  episode_id: z.string().min(1).max(ID_MAX_LENGTH),
  page_size: z.number().int().min(1).max(10_000).optional().default(DEFAULT_SEARCH_AFTER_PAGE_SIZE),
  max_events: z
    .number()
    .int()
    .min(1)
    .max(DEFAULT_SEARCH_AFTER_MAX_EVENTS)
    .optional()
    .default(DEFAULT_SEARCH_AFTER_MAX_EVENTS),
  include_spans: z.boolean().optional().default(false),
});

export const spanPerfTopZipRequestSchema = z.object({
  episode_id: z.string().min(1).max(ID_MAX_LENGTH),
  include_spans: z.boolean().optional().default(false),
});

export const spanPerfEsqlRequestSchema = spanPerfTopZipRequestSchema;
export const spanPerfValuesZipRequestSchema = spanPerfTopZipRequestSchema;

export const spanPerfResponseSchema = z.union([
  z.object({
    result: z.literal('ok'),
    method: z.enum(['search_after', 'top_zip', 'esql', 'values_zip']),
    episode_id: z.string(),
    space_id: z.string(),
    truncated: z.boolean(),
    counts: z.object({
      events: z.number().int(),
      spans: z.number().int(),
    }),
    timings: timingsSchema,
    sample: z.array(statusSpanSchema).max(6),
    spans: z.array(statusSpanSchema).max(DEFAULT_SEARCH_AFTER_MAX_EVENTS).optional(),
  }),
  z.object({
    result: z.literal('error'),
    method: z.enum(['search_after', 'top_zip', 'esql', 'values_zip']),
    episode_id: z.string(),
    space_id: z.string(),
    error: z.object({
      status_code: z.number().int().nullable(),
      type: z.string().nullable(),
      reason: z.string(),
    }),
    timings: z.object({
      elasticsearch_wall_ms: z.number(),
      total_ms: z.number(),
    }),
  }),
]);

export const spanPerfRouteResponse = {
  200: {
    body: () => spanPerfResponseSchema,
    description: 'Span derivation timings and counts (temporary perf probe).',
  },
  400: {
    body: () => errorResponseSchema,
    description: 'Indicates the request failed schema validation.',
  },
} as const;

export type SpanPerfSearchAfterRequest = z.infer<typeof spanPerfSearchAfterRequestSchema>;
export type SpanPerfTopZipRequest = z.infer<typeof spanPerfTopZipRequestSchema>;
export type SpanPerfEsqlRequest = z.infer<typeof spanPerfEsqlRequestSchema>;
export type SpanPerfValuesZipRequest = z.infer<typeof spanPerfValuesZipRequestSchema>;
