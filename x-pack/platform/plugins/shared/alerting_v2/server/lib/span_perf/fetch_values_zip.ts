/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { buildValuesZipSpansQuery, VALUES_ZIP_EVENT_CAP } from './build_values_zip_query';
import { esqlResponseToRows, esqlTookMs } from './esql_response_to_rows';
import { firstNumber, firstString } from './first_field';
import { toIsoTimestamp } from './to_iso_timestamp';
import type { QueryServiceContract } from '../services/query_service/query_service';
import type { StatusSpan } from './types';

interface ValuesZipRow {
  'episode.id': unknown;
  'rule.id': unknown;
  group_hash: unknown;
  status_started_at: unknown;
  previous_status: unknown;
  episode_status: unknown;
  duration_ms: unknown;
  status_ended_at: unknown;
  event_count: unknown;
}

export interface FetchValuesZipResult {
  spans: StatusSpan[];
  eventCount: number;
  elasticsearchTookMs: number | null;
  truncated: boolean;
}

/** Map ES VALUES-zip span rows. Duration is already computed in ES. */
export const fetchValuesZip = async ({
  queryService,
  episodeId,
  spaceId,
}: {
  queryService: QueryServiceContract;
  episodeId: string;
  spaceId: string;
}): Promise<FetchValuesZipResult> => {
  const response = await queryService.executeQuery({
    query: buildValuesZipSpansQuery(episodeId, spaceId),
  });
  const rows = esqlResponseToRows<ValuesZipRow>(response);
  const spans: StatusSpan[] = [];
  let eventCount = 0;

  for (const row of rows) {
    const statusStartedAt = toIsoTimestamp(row.status_started_at);
    const episodeStatus = firstString(row.episode_status);
    const rowEpisodeId = firstString(row['episode.id']);
    const durationMs = firstNumber(row.duration_ms);
    if (!statusStartedAt || !episodeStatus || !rowEpisodeId || durationMs == null) {
      continue;
    }

    const counted = firstNumber(row.event_count);
    if (counted != null) {
      eventCount = counted;
    }

    const statusEndedAt = toIsoTimestamp(row.status_ended_at) ?? null;

    spans.push({
      episodeId: rowEpisodeId,
      ruleId: firstString(row['rule.id']) ?? null,
      groupHash: firstString(row.group_hash) ?? null,
      statusStartedAt,
      previousStatus: firstString(row.previous_status) ?? null,
      episodeStatus,
      durationMs,
      statusEndedAt,
    });
  }

  return {
    spans,
    eventCount,
    elasticsearchTookMs: esqlTookMs(response),
    truncated: eventCount > VALUES_ZIP_EVENT_CAP || spans.length >= VALUES_ZIP_EVENT_CAP,
  };
};
