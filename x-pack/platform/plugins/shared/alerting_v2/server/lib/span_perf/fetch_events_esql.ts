/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { buildEsqlEventsQuery, ESQL_EVENT_CAP } from './build_esql_events_query';
import { esqlResponseToRows, esqlTookMs } from './esql_response_to_rows';
import { firstString } from './first_field';
import { toIsoTimestamp } from './to_iso_timestamp';
import type { QueryServiceContract } from '../services/query_service/query_service';
import type { EpisodeEvent } from './types';

interface EsqlEventRow {
  '@timestamp': unknown;
  'episode.id': unknown;
  'episode.status': unknown;
  'rule.id': unknown;
  group_hash: unknown;
}

export interface FetchEventsEsqlResult {
  events: EpisodeEvent[];
  elasticsearchTookMs: number | null;
  truncated: boolean;
}

export const fetchEventsEsql = async ({
  queryService,
  episodeId,
  spaceId,
}: {
  queryService: QueryServiceContract;
  episodeId: string;
  spaceId: string;
}): Promise<FetchEventsEsqlResult> => {
  const response = await queryService.executeQuery({
    query: buildEsqlEventsQuery(episodeId, spaceId),
  });
  const rows = esqlResponseToRows<EsqlEventRow>(response);
  const events: EpisodeEvent[] = [];

  for (const row of rows) {
    const timestamp = toIsoTimestamp(row['@timestamp']);
    const episodeStatus = firstString(row['episode.status']);
    const hitEpisodeId = firstString(row['episode.id']);
    if (!timestamp || !episodeStatus || !hitEpisodeId) {
      continue;
    }

    events.push({
      timestamp,
      episodeStatus,
      episodeId: hitEpisodeId,
      ruleId: firstString(row['rule.id']) ?? null,
      groupHash: firstString(row.group_hash) ?? null,
    });
  }

  return {
    events,
    elasticsearchTookMs: esqlTookMs(response),
    truncated: events.length >= ESQL_EVENT_CAP,
  };
};
