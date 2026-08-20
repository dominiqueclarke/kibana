/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ALERT_EPISODE_STATUS } from '@kbn/alerting-v2-schemas';
import type { AlertEpisode } from '@kbn/alerting-v2-schemas';
import { toFocusedEpisode } from './to_focused_episode';

const episode: AlertEpisode = {
  '@timestamp': '2026-04-23T00:00:00Z',
  'episode.id': 'e1',
  'episode.status': ALERT_EPISODE_STATUS.ACTIVE,
  'rule.id': 'rule-1',
  group_hash: 'g1',
  first_timestamp: '2026-04-23T00:00:00Z',
  last_timestamp: '2026-04-23T00:00:00Z',
  duration: 0,
};

describe('toFocusedEpisode', () => {
  it('uses the cached rule name and grouping fields', () => {
    expect(
      toFocusedEpisode(episode, {
        metadata: { name: 'Host CPU high' },
        grouping: { fields: ['host.name'] },
      })
    ).toEqual({
      episode,
      ruleName: 'Host CPU high',
      groupingFields: ['host.name'],
    });
  });

  it('falls back to episode_data.rule_name when the rule is not cached', () => {
    expect(
      toFocusedEpisode({
        ...episode,
        episode_data: JSON.stringify({ rule_name: 'External CPU alert' }),
      })
    ).toEqual(
      expect.objectContaining({
        ruleName: 'External CPU alert',
        groupingFields: undefined,
      })
    );
  });

  it('prefers the cached rule name over episode_data.rule_name', () => {
    expect(
      toFocusedEpisode(
        {
          ...episode,
          episode_data: JSON.stringify({ rule_name: 'External CPU alert' }),
        },
        { metadata: { name: 'Host CPU high' } }
      ).ruleName
    ).toBe('Host CPU high');
  });
});
