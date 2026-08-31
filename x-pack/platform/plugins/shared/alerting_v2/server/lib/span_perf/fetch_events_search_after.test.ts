/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ElasticsearchClient } from '@kbn/core/server';
import { elasticsearchServiceMock } from '@kbn/core-elasticsearch-server-mocks';
import { fetchEventsSearchAfter } from './fetch_events_search_after';

const hit = (timestamp: string, status: string, sort: unknown[]) => ({
  _index: '.ds-.rule-events-000001',
  _id: `id-${timestamp}`,
  sort,
  fields: {
    '@timestamp': [timestamp],
    'episode.status': [status],
    'episode.id': ['ep-1'],
    'rule.id': ['rule-1'],
    group_hash: ['g-1'],
  },
});

describe('fetchEventsSearchAfter', () => {
  let esClient: ReturnType<typeof elasticsearchServiceMock.createElasticsearchClient>;

  beforeEach(() => {
    esClient = elasticsearchServiceMock.createElasticsearchClient();
    esClient.openPointInTime.mockResolvedValue({ id: 'pit-1' } as never);
    esClient.closePointInTime.mockResolvedValue({ succeeded: true, num_freed: 1 } as never);
  });

  it('pages until a short page and maps fields onto ordered events', async () => {
    esClient.search
      .mockResolvedValueOnce({
        took: 4,
        timed_out: false,
        _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
        hits: {
          hits: [
            hit('2026-01-01T00:00:00.000Z', 'active', ['t0', 'a']),
            hit('2026-01-01T00:00:01.000Z', 'recovering', ['t1', 'b']),
          ],
        },
      } as never)
      .mockResolvedValueOnce({
        took: 3,
        timed_out: false,
        _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
        hits: {
          hits: [hit('2026-01-01T00:00:02.000Z', 'active', ['t2', 'c'])],
        },
      } as never);

    const result = await fetchEventsSearchAfter({
      esClient: esClient as unknown as ElasticsearchClient,
      episodeId: 'ep-1',
      spaceId: 'default',
      pageSize: 2,
    });

    expect(result.pages).toBe(2);
    expect(result.elasticsearchTookMs).toBe(7);
    expect(result.truncated).toBe(false);
    expect(result.events.map((event) => event.episodeStatus)).toEqual([
      'active',
      'recovering',
      'active',
    ]);
    expect(esClient.search).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        search_after: ['t1', 'b'],
        pit: { id: 'pit-1', keep_alive: '1m' },
      })
    );
    expect(esClient.closePointInTime).toHaveBeenCalledWith({ id: 'pit-1' });
  });

  it('stops at maxEvents and reports truncated', async () => {
    esClient.search.mockResolvedValue({
      took: 1,
      timed_out: false,
      _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
      hits: {
        hits: [
          hit('2026-01-01T00:00:00.000Z', 'active', ['t0', 'a']),
          hit('2026-01-01T00:00:01.000Z', 'recovering', ['t1', 'b']),
        ],
      },
    } as never);

    const result = await fetchEventsSearchAfter({
      esClient: esClient as unknown as ElasticsearchClient,
      episodeId: 'ep-1',
      spaceId: 'default',
      pageSize: 2,
      maxEvents: 2,
    });

    expect(result.events).toHaveLength(2);
    expect(result.truncated).toBe(true);
    expect(esClient.search).toHaveBeenCalledTimes(1);
  });
});
