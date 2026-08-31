/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { QueryServiceContract } from '../services/query_service/query_service';
import { fetchEventsEsql } from './fetch_events_esql';

describe('fetchEventsEsql', () => {
  it('maps ES|QL columns onto ordered EpisodeEvents', async () => {
    const queryService = {
      executeQuery: jest.fn().mockResolvedValue({
        took: 9,
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
      }),
    };

    const result = await fetchEventsEsql({
      queryService: queryService as unknown as QueryServiceContract,
      episodeId: 'ep-1',
      spaceId: 'default',
    });

    expect(result.elasticsearchTookMs).toBe(9);
    expect(result.truncated).toBe(false);
    expect(result.events).toEqual([
      {
        timestamp: '2026-01-01T00:00:00.000Z',
        episodeStatus: 'active',
        episodeId: 'ep-1',
        ruleId: 'rule-1',
        groupHash: 'g-1',
      },
      {
        timestamp: '2026-01-01T00:00:01.000Z',
        episodeStatus: 'recovering',
        episodeId: 'ep-1',
        ruleId: 'rule-1',
        groupHash: 'g-1',
      },
    ]);
    expect(queryService.executeQuery).toHaveBeenCalledWith({
      query: expect.stringContaining('"ep-1"'),
    });
  });

  it('marks truncated when the ES|QL cap is filled', async () => {
    const values = Array.from({ length: 10_000 }, (_, i) => [
      new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString(),
      'ep-1',
      'active',
      'rule-1',
      'g-1',
    ]);
    const queryService = {
      executeQuery: jest.fn().mockResolvedValue({
        took: 1,
        columns: [
          { name: '@timestamp', type: 'date' },
          { name: 'episode.id', type: 'keyword' },
          { name: 'episode.status', type: 'keyword' },
          { name: 'rule.id', type: 'keyword' },
          { name: 'group_hash', type: 'keyword' },
        ],
        values,
      }),
    };

    const result = await fetchEventsEsql({
      queryService: queryService as unknown as QueryServiceContract,
      episodeId: 'ep-1',
      spaceId: 'default',
    });

    expect(result.events).toHaveLength(10_000);
    expect(result.truncated).toBe(true);
  });
});
