/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ElasticsearchClient } from '@kbn/core/server';
import type { SortResults } from '@elastic/elasticsearch/lib/api/types';
import { ALERT_EVENTS_DATA_STREAM } from '@kbn/alerting-v2-constants';
import { firstString } from './first_field';
import { toIsoTimestamp } from './to_iso_timestamp';
import type { EpisodeEvent } from './types';

export const DEFAULT_SEARCH_AFTER_PAGE_SIZE = 2000;
export const DEFAULT_SEARCH_AFTER_MAX_EVENTS = 100_000;

export interface FetchEventsSearchAfterParams {
  esClient: ElasticsearchClient;
  episodeId: string;
  spaceId: string;
  pageSize?: number;
  maxEvents?: number;
}

export interface FetchEventsSearchAfterResult {
  events: EpisodeEvent[];
  pages: number;
  elasticsearchTookMs: number;
  truncated: boolean;
}

export const fetchEventsSearchAfter = async ({
  esClient,
  episodeId,
  spaceId,
  pageSize = DEFAULT_SEARCH_AFTER_PAGE_SIZE,
  maxEvents = DEFAULT_SEARCH_AFTER_MAX_EVENTS,
}: FetchEventsSearchAfterParams): Promise<FetchEventsSearchAfterResult> => {
  const events: EpisodeEvent[] = [];
  let searchAfter: SortResults | undefined;
  let pages = 0;
  let elasticsearchTookMs = 0;
  let truncated = false;

  // `_id` sort is disabled (indices.id_field_data.enabled). PIT + `_shard_doc`
  // is the data-stream-safe search_after tiebreaker.
  const keepAlive = '1m';
  const pit = await esClient.openPointInTime({
    index: ALERT_EVENTS_DATA_STREAM,
    keep_alive: keepAlive,
  });
  let pitId = pit.id;

  try {
    while (events.length < maxEvents) {
      const size = Math.min(pageSize, maxEvents - events.length);
      const response = await esClient.search({
        size,
        pit: { id: pitId, keep_alive: keepAlive },
        _source: false,
        track_total_hits: false,
        fields: [
          { field: '@timestamp', format: 'strict_date_optional_time' },
          'episode.status',
          'episode.id',
          'rule.id',
          'group_hash',
        ],
        query: {
          bool: {
            filter: [
              { term: { type: 'alert' } },
              { term: { space_id: spaceId } },
              { term: { 'episode.id': episodeId } },
              { exists: { field: 'episode.status' } },
            ],
          },
        },
        sort: [{ '@timestamp': 'asc' }, { _shard_doc: 'asc' }],
        ...(searchAfter ? { search_after: searchAfter } : {}),
      });

      pitId = response.pit_id ?? pitId;
      elasticsearchTookMs += response.took ?? 0;
      pages += 1;

      const hits = response.hits.hits;
      if (hits.length === 0) {
        break;
      }

      for (const hit of hits) {
        const fields = hit.fields ?? {};
        const timestamp = toIsoTimestamp(fields['@timestamp']);
        const episodeStatus = firstString(fields['episode.status']);
        const hitEpisodeId = firstString(fields['episode.id']);
        if (!timestamp || !episodeStatus || !hitEpisodeId) {
          continue;
        }

        events.push({
          timestamp,
          episodeStatus,
          episodeId: hitEpisodeId,
          ruleId: firstString(fields['rule.id']) ?? null,
          groupHash: firstString(fields.group_hash) ?? null,
        });
      }

      const lastHit = hits[hits.length - 1];
      searchAfter = lastHit.sort;
      if (hits.length < size) {
        break;
      }

      if (events.length >= maxEvents) {
        truncated = true;
        break;
      }
    }
  } finally {
    try {
      await esClient.closePointInTime({ id: pitId });
    } catch {
      // PIT expires via keep_alive if close fails.
    }
  }

  return { events, pages, elasticsearchTookMs, truncated };
};
