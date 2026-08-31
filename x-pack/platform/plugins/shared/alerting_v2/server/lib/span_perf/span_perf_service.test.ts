/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ElasticsearchClient } from '@kbn/core/server';
import type { DiagnosticResult } from '@elastic/elasticsearch';
import { errors } from '@elastic/elasticsearch';
import type { QueryServiceContract } from '../services/query_service/query_service';
import { SpanPerfService } from './span_perf_service';
import { TOP_ZIP_PREV_START_SENTINEL } from './attach_durations_to_span_starts';

const hit = (timestamp: string, status: string) => ({
  _index: '.ds-.rule-events-000001',
  _id: timestamp,
  sort: [timestamp, timestamp],
  fields: {
    '@timestamp': [timestamp],
    'episode.status': [status],
    'episode.id': ['ep-1'],
    'rule.id': ['rule-1'],
    group_hash: ['g-1'],
  },
});

describe('SpanPerfService', () => {
  const esClient = {
    search: jest.fn(),
    openPointInTime: jest.fn().mockResolvedValue({ id: 'pit-1' }),
    closePointInTime: jest.fn().mockResolvedValue({ succeeded: true }),
  };
  const queryService = {
    executeQuery: jest.fn(),
  };

  const service = new SpanPerfService(
    esClient as unknown as ElasticsearchClient,
    queryService as unknown as QueryServiceContract,
    'default'
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('measures search_after paging plus Kibana RLE', async () => {
    esClient.search.mockResolvedValue({
      took: 11,
      hits: {
        hits: [
          hit('2026-01-01T00:00:00.000Z', 'active'),
          hit('2026-01-01T00:00:01.000Z', 'recovering'),
        ],
      },
    });

    const result = await service.measureSearchAfter({ episodeId: 'ep-1' });

    expect(result.result).toBe('ok');
    if (result.result !== 'ok') {
      throw new Error('expected ok');
    }
    expect(result.method).toBe('search_after');
    expect(result.counts).toEqual({ events: 2, spans: 2 });
    expect(result.timings.pages).toBe(1);
    expect(result.timings.elasticsearch_took_ms).toBe(11);
    expect(result.sample).toHaveLength(2);
    expect(result.spans).toBeUndefined();
  });

  it('measures TOP zip plus Kibana duration', async () => {
    queryService.executeQuery.mockResolvedValue({
      took: 22,
      columns: [
        { name: 'status_started_at', type: 'date' },
        { name: 'episode.id', type: 'keyword' },
        { name: 'episode_status', type: 'keyword' },
        { name: 'prev_status', type: 'keyword' },
        { name: 'episode_latest_ts', type: 'date' },
        { name: 'event_count', type: 'long' },
        { name: 'rule_id', type: 'keyword' },
        { name: 'group_hash', type: 'keyword' },
      ],
      values: [
        [
          '2026-01-01T00:00:00.000Z',
          'ep-1',
          'active',
          TOP_ZIP_PREV_START_SENTINEL,
          '2026-01-01T00:00:09.000Z',
          9,
          'rule-1',
          'g-1',
        ],
        [
          '2026-01-01T00:00:02.000Z',
          'ep-1',
          'recovering',
          'active',
          '2026-01-01T00:00:09.000Z',
          9,
          'rule-1',
          'g-1',
        ],
      ],
    });

    const result = await service.measureTopZip({ episodeId: 'ep-1', includeSpans: true });

    expect(result.result).toBe('ok');
    if (result.result !== 'ok') {
      throw new Error('expected ok');
    }
    expect(result.method).toBe('top_zip');
    expect(result.counts).toEqual({ events: 9, spans: 2 });
    expect(result.timings.elasticsearch_took_ms).toBe(22);
    expect(result.spans?.[0].durationMs).toBe(2000);
    expect(result.spans?.[1].durationMs).toBe(7000);
    expect(result.spans?.[1].statusEndedAt).toBeNull();
  });

  it('measures one-shot ES|QL plus Kibana RLE', async () => {
    queryService.executeQuery.mockResolvedValue({
      took: 17,
      columns: [
        { name: '@timestamp', type: 'date' },
        { name: 'episode.id', type: 'keyword' },
        { name: 'episode.status', type: 'keyword' },
        { name: 'rule.id', type: 'keyword' },
        { name: 'group_hash', type: 'keyword' },
      ],
      values: [
        ['2026-01-01T00:00:00.000Z', 'ep-1', 'active', 'rule-1', 'g-1'],
        ['2026-01-01T00:00:01.000Z', 'ep-1', 'recovering', 'rule-1', 'g-1'],
      ],
    });

    const result = await service.measureEsql({ episodeId: 'ep-1' });

    expect(result.result).toBe('ok');
    if (result.result !== 'ok') {
      throw new Error('expected ok');
    }
    expect(result.method).toBe('esql');
    expect(result.counts).toEqual({ events: 2, spans: 2 });
    expect(result.timings.pages).toBe(1);
    expect(result.timings.elasticsearch_took_ms).toBe(17);
    expect(result.truncated).toBe(false);
    expect(queryService.executeQuery).toHaveBeenCalledWith({
      query: expect.stringContaining('LIMIT 10000'),
    });
  });

  it('returns a structured error payload when ES|QL circuit-breaks', async () => {
    queryService.executeQuery.mockRejectedValue(
      new errors.ResponseError({
        statusCode: 429,
        body: {
          error: { type: 'circuit_breaking_exception', reason: '[request] Data too large' },
        },
      } as DiagnosticResult)
    );

    const result = await service.measureTopZip({ episodeId: 'ep-1' });

    expect(result.result).toBe('error');
    if (result.result !== 'error') {
      throw new Error('expected error');
    }
    expect(result.error).toEqual({
      status_code: 429,
      type: 'circuit_breaking_exception',
      reason: '[request] Data too large',
    });
  });

  it('measures VALUES zip using ES-computed duration', async () => {
    queryService.executeQuery.mockResolvedValue({
      took: 88,
      columns: [
        { name: 'episode.id', type: 'keyword' },
        { name: 'rule.id', type: 'keyword' },
        { name: 'group_hash', type: 'keyword' },
        { name: 'status_started_at', type: 'date' },
        { name: 'previous_status', type: 'keyword' },
        { name: 'episode_status', type: 'keyword' },
        { name: 'duration_ms', type: 'long' },
        { name: 'status_ended_at', type: 'date' },
        { name: 'event_count', type: 'long' },
      ],
      values: [
        ['ep-1', 'rule-1', 'g-1', '2026-01-01T00:00:00.000Z', null, 'active', 2000, '2026-01-01T00:00:02.000Z', 9],
        ['ep-1', 'rule-1', 'g-1', '2026-01-01T00:00:02.000Z', 'active', 'recovering', 7000, null, 9],
      ],
    });

    const result = await service.measureValuesZip({ episodeId: 'ep-1', includeSpans: true });

    expect(result.result).toBe('ok');
    if (result.result !== 'ok') {
      throw new Error('expected ok');
    }
    expect(result.method).toBe('values_zip');
    expect(result.counts).toEqual({ events: 9, spans: 2 });
    expect(result.timings.elasticsearch_took_ms).toBe(88);
    expect(result.timings.kibana_ms).toBe(0);
    expect(result.spans?.[0].durationMs).toBe(2000);
    expect(result.spans?.[1].durationMs).toBe(7000);
    expect(result.spans?.[1].statusEndedAt).toBeNull();
    expect(queryService.executeQuery).toHaveBeenCalledWith({
      query: expect.stringContaining('duration_ms'),
    });
  });

  it('returns a structured error payload when VALUES zip circuit-breaks', async () => {
    queryService.executeQuery.mockRejectedValue(
      new errors.ResponseError({
        statusCode: 429,
        body: {
          error: { type: 'circuit_breaking_exception', reason: '[request] Data too large' },
        },
      } as DiagnosticResult)
    );

    const result = await service.measureValuesZip({ episodeId: 'ep-1' });

    expect(result.result).toBe('error');
    if (result.result !== 'error') {
      throw new Error('expected error');
    }
    expect(result.method).toBe('values_zip');
    expect(result.error.status_code).toBe(429);
  });

  it('returns a structured error payload when one-shot ES|QL circuit-breaks', async () => {
    queryService.executeQuery.mockRejectedValue(
      new errors.ResponseError({
        statusCode: 429,
        body: {
          error: { type: 'circuit_breaking_exception', reason: '[request] Data too large' },
        },
      } as DiagnosticResult)
    );

    const result = await service.measureEsql({ episodeId: 'ep-1' });

    expect(result.result).toBe('error');
    if (result.result !== 'error') {
      throw new Error('expected error');
    }
    expect(result.method).toBe('esql');
    expect(result.error.status_code).toBe(429);
  });
});
