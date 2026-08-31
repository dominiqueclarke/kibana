/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/** Ordered `.rule-events` row used by the search_after reducer. */
export interface EpisodeEvent {
  timestamp: string;
  episodeStatus: string;
  episodeId: string;
  ruleId: string | null;
  groupHash: string | null;
}

/** Span-start row produced by the TOP zip ES|QL query (no duration yet). */
export interface SpanStart {
  statusStartedAt: string;
  episodeStatus: string;
  prevStatus: string | null;
  episodeId: string;
  ruleId: string | null;
  groupHash: string | null;
}

/**
 * Contiguous `episode.status` run. Last span keeps `statusEndedAt: null`
 * and measures `durationMs` against the episode's latest event timestamp.
 */
export interface StatusSpan {
  episodeId: string;
  ruleId: string | null;
  groupHash: string | null;
  statusStartedAt: string;
  previousStatus: string | null;
  episodeStatus: string;
  durationMs: number;
  statusEndedAt: string | null;
}

export interface SpanPerfTimings {
  elasticsearch_took_ms: number | null;
  elasticsearch_wall_ms: number;
  kibana_ms: number;
  total_ms: number;
  pages?: number;
}

export interface SpanPerfOkResult {
  result: 'ok';
  method: 'search_after' | 'top_zip' | 'esql' | 'values_zip';
  episode_id: string;
  space_id: string;
  truncated: boolean;
  counts: {
    events: number;
    spans: number;
  };
  timings: SpanPerfTimings;
  sample: StatusSpan[];
  spans?: StatusSpan[];
}

export interface SpanPerfErrorResult {
  result: 'error';
  method: 'search_after' | 'top_zip' | 'esql' | 'values_zip';
  episode_id: string;
  space_id: string;
  error: {
    status_code: number | null;
    type: string | null;
    reason: string;
  };
  timings: Pick<SpanPerfTimings, 'elasticsearch_wall_ms' | 'total_ms'>;
}

export type SpanPerfResult = SpanPerfOkResult | SpanPerfErrorResult;
