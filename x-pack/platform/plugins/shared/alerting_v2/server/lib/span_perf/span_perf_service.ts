/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ElasticsearchClient } from '@kbn/core/server';
import { inject, injectable } from 'inversify';
import { attachDurationsToSpanStarts } from './attach_durations_to_span_starts';
import { buildTopZipSpanStartsQuery, TOP_ZIP_EVENT_CAP } from './build_top_zip_query';
import { deriveStatusSpans } from './derive_status_spans';
import { elapsedMs, nowNs } from './elapsed_ms';
import { esqlResponseToRows, esqlTookMs } from './esql_response_to_rows';
import { fetchEventsEsql } from './fetch_events_esql';
import { fetchValuesZip } from './fetch_values_zip';
import {
  DEFAULT_SEARCH_AFTER_MAX_EVENTS,
  DEFAULT_SEARCH_AFTER_PAGE_SIZE,
  fetchEventsSearchAfter,
} from './fetch_events_search_after';
import { firstString } from './first_field';
import { sampleSpans } from './sample_spans';
import { toIsoTimestamp } from './to_iso_timestamp';
import { toSpanPerfError } from './to_span_perf_error';
import type { QueryServiceContract } from '../services/query_service/query_service';
import { QueryServiceScopedToken } from '../services/query_service/tokens';
import { EsServiceScopedToken } from '../services/es_service/tokens';
import { RequestSpaceIdToken } from '../services/spaces_service/tokens';
import type { SpanPerfOkResult, SpanPerfResult, SpanStart } from './types';

export interface MeasureSearchAfterArgs {
  episodeId: string;
  pageSize?: number;
  maxEvents?: number;
  includeSpans?: boolean;
}

export interface MeasureTopZipArgs {
  episodeId: string;
  includeSpans?: boolean;
}

export interface MeasureEsqlArgs {
  episodeId: string;
  includeSpans?: boolean;
}

export interface MeasureValuesZipArgs {
  episodeId: string;
  includeSpans?: boolean;
}

interface TopZipRow {
  status_started_at: unknown;
  'episode.id': unknown;
  episode_status: unknown;
  prev_status: unknown;
  episode_latest_ts: unknown;
  event_count: unknown;
  rule_id: unknown;
  group_hash: unknown;
}

const roundMs = (ms: number): number => Math.round(ms * 10) / 10;

@injectable()
export class SpanPerfService {
  constructor(
    @inject(EsServiceScopedToken) private readonly esClient: ElasticsearchClient,
    @inject(QueryServiceScopedToken) private readonly queryService: QueryServiceContract,
    @inject(RequestSpaceIdToken) private readonly spaceId: string
  ) {}

  async measureSearchAfter({
    episodeId,
    pageSize = DEFAULT_SEARCH_AFTER_PAGE_SIZE,
    maxEvents = DEFAULT_SEARCH_AFTER_MAX_EVENTS,
    includeSpans = false,
  }: MeasureSearchAfterArgs): Promise<SpanPerfResult> {
    const totalStarted = nowNs();
    let elasticsearchWallMs = 0;

    try {
      const esStarted = nowNs();
      const fetched = await fetchEventsSearchAfter({
        esClient: this.esClient,
        episodeId,
        spaceId: this.spaceId,
        pageSize,
        maxEvents,
      });
      elasticsearchWallMs = elapsedMs(esStarted);

      const kibanaStarted = nowNs();
      const spans = deriveStatusSpans(fetched.events);
      const kibanaMs = elapsedMs(kibanaStarted);

      const result: SpanPerfOkResult = {
        result: 'ok',
        method: 'search_after',
        episode_id: episodeId,
        space_id: this.spaceId,
        truncated: fetched.truncated,
        counts: {
          events: fetched.events.length,
          spans: spans.length,
        },
        timings: {
          elasticsearch_took_ms: fetched.elasticsearchTookMs,
          elasticsearch_wall_ms: roundMs(elasticsearchWallMs),
          kibana_ms: roundMs(kibanaMs),
          total_ms: roundMs(elapsedMs(totalStarted)),
          pages: fetched.pages,
        },
        sample: sampleSpans(spans),
        ...(includeSpans ? { spans } : {}),
      };

      return result;
    } catch (error) {
      return {
        result: 'error',
        method: 'search_after',
        episode_id: episodeId,
        space_id: this.spaceId,
        error: toSpanPerfError(error),
        timings: {
          elasticsearch_wall_ms: roundMs(elasticsearchWallMs || elapsedMs(totalStarted)),
          total_ms: roundMs(elapsedMs(totalStarted)),
        },
      };
    }
  }

  async measureTopZip({
    episodeId,
    includeSpans = false,
  }: MeasureTopZipArgs): Promise<SpanPerfResult> {
    const totalStarted = nowNs();
    let elasticsearchWallMs = 0;

    try {
      const esStarted = nowNs();
      const response = await this.queryService.executeQuery({
        query: buildTopZipSpanStartsQuery(episodeId),
      });
      elasticsearchWallMs = elapsedMs(esStarted);

      const kibanaStarted = nowNs();
      const rows = esqlResponseToRows<TopZipRow>(response);
      const starts: SpanStart[] = [];
      let episodeLatestTs: string | undefined;
      let eventCount = 0;

      for (const row of rows) {
        const statusStartedAt = toIsoTimestamp(row.status_started_at);
        const episodeStatus = firstString(row.episode_status);
        const rowEpisodeId = firstString(row['episode.id']);
        if (!statusStartedAt || !episodeStatus || !rowEpisodeId) {
          continue;
        }

        episodeLatestTs = toIsoTimestamp(row.episode_latest_ts) ?? episodeLatestTs;
        const counted = row.event_count;
        if (typeof counted === 'number') {
          eventCount = counted;
        }

        starts.push({
          statusStartedAt,
          episodeStatus,
          prevStatus: firstString(row.prev_status) ?? null,
          episodeId: rowEpisodeId,
          ruleId: firstString(row.rule_id) ?? null,
          groupHash: firstString(row.group_hash) ?? null,
        });
      }

      const latest = episodeLatestTs ?? starts[starts.length - 1]?.statusStartedAt ?? '';
      const spans = attachDurationsToSpanStarts(starts, latest);
      const kibanaMs = elapsedMs(kibanaStarted);

      const result: SpanPerfOkResult = {
        result: 'ok',
        method: 'top_zip',
        episode_id: episodeId,
        space_id: this.spaceId,
        truncated: eventCount > TOP_ZIP_EVENT_CAP,
        counts: {
          events: eventCount,
          spans: spans.length,
        },
        timings: {
          elasticsearch_took_ms: esqlTookMs(response),
          elasticsearch_wall_ms: roundMs(elasticsearchWallMs),
          kibana_ms: roundMs(kibanaMs),
          total_ms: roundMs(elapsedMs(totalStarted)),
        },
        sample: sampleSpans(spans),
        ...(includeSpans ? { spans } : {}),
      };

      return result;
    } catch (error) {
      return {
        result: 'error',
        method: 'top_zip',
        episode_id: episodeId,
        space_id: this.spaceId,
        error: toSpanPerfError(error),
        timings: {
          elasticsearch_wall_ms: roundMs(elasticsearchWallMs || elapsedMs(totalStarted)),
          total_ms: roundMs(elapsedMs(totalStarted)),
        },
      };
    }
  }

  async measureEsql({ episodeId, includeSpans = false }: MeasureEsqlArgs): Promise<SpanPerfResult> {
    const totalStarted = nowNs();
    let elasticsearchWallMs = 0;

    try {
      const esStarted = nowNs();
      const fetched = await fetchEventsEsql({
        queryService: this.queryService,
        episodeId,
        spaceId: this.spaceId,
      });
      elasticsearchWallMs = elapsedMs(esStarted);

      const kibanaStarted = nowNs();
      const spans = deriveStatusSpans(fetched.events);
      const kibanaMs = elapsedMs(kibanaStarted);

      const result: SpanPerfOkResult = {
        result: 'ok',
        method: 'esql',
        episode_id: episodeId,
        space_id: this.spaceId,
        truncated: fetched.truncated,
        counts: {
          events: fetched.events.length,
          spans: spans.length,
        },
        timings: {
          elasticsearch_took_ms: fetched.elasticsearchTookMs,
          elasticsearch_wall_ms: roundMs(elasticsearchWallMs),
          kibana_ms: roundMs(kibanaMs),
          total_ms: roundMs(elapsedMs(totalStarted)),
          pages: 1,
        },
        sample: sampleSpans(spans),
        ...(includeSpans ? { spans } : {}),
      };

      return result;
    } catch (error) {
      return {
        result: 'error',
        method: 'esql',
        episode_id: episodeId,
        space_id: this.spaceId,
        error: toSpanPerfError(error),
        timings: {
          elasticsearch_wall_ms: roundMs(elasticsearchWallMs || elapsedMs(totalStarted)),
          total_ms: roundMs(elapsedMs(totalStarted)),
        },
      };
    }
  }

  async measureValuesZip({
    episodeId,
    includeSpans = false,
  }: MeasureValuesZipArgs): Promise<SpanPerfResult> {
    const totalStarted = nowNs();
    let elasticsearchWallMs = 0;

    try {
      const esStarted = nowNs();
      const fetched = await fetchValuesZip({
        queryService: this.queryService,
        episodeId,
        spaceId: this.spaceId,
      });
      elasticsearchWallMs = elapsedMs(esStarted);

      const result: SpanPerfOkResult = {
        result: 'ok',
        method: 'values_zip',
        episode_id: episodeId,
        space_id: this.spaceId,
        truncated: fetched.truncated,
        counts: {
          events: fetched.eventCount,
          spans: fetched.spans.length,
        },
        timings: {
          elasticsearch_took_ms: fetched.elasticsearchTookMs,
          elasticsearch_wall_ms: roundMs(elasticsearchWallMs),
          kibana_ms: 0,
          total_ms: roundMs(elapsedMs(totalStarted)),
        },
        sample: sampleSpans(fetched.spans),
        ...(includeSpans ? { spans: fetched.spans } : {}),
      };

      return result;
    } catch (error) {
      return {
        result: 'error',
        method: 'values_zip',
        episode_id: episodeId,
        space_id: this.spaceId,
        error: toSpanPerfError(error),
        timings: {
          elasticsearch_wall_ms: roundMs(elasticsearchWallMs || elapsedMs(totalStarted)),
          total_ms: roundMs(elapsedMs(totalStarted)),
        },
      };
    }
  }
}
