/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { AlertEpisode } from '@kbn/alerting-v2-schemas';
import { createAddToChatAction } from './add_to_chat';

const makeEpisode = (overrides: Partial<AlertEpisode> = {}): AlertEpisode => ({
  '@timestamp': '2026-04-23T00:00:00Z',
  'episode.id': 'e1',
  'episode.status': 'active' as any,
  'rule.id': 'r1',
  group_hash: 'g1',
  first_timestamp: '2026-04-23T00:00:00Z',
  last_timestamp: '2026-04-23T00:00:00Z',
  duration: 0,
  ...overrides,
});

describe('createAddToChatAction', () => {
  it('is compatible when addToChat is provided and at least one episode is selected', () => {
    const action = createAddToChatAction({ addToChat: jest.fn() });

    expect(action.isCompatible({ episodes: [makeEpisode()] })).toBe(true);
    expect(
      action.isCompatible({
        episodes: [makeEpisode(), makeEpisode({ 'episode.id': 'e2' })],
      })
    ).toBe(true);
  });

  it('is not compatible on empty selection', () => {
    expect(createAddToChatAction({ addToChat: jest.fn() }).isCompatible({ episodes: [] })).toBe(
      false
    );
  });

  it('is not compatible when addToChat is omitted', () => {
    expect(createAddToChatAction({}).isCompatible({ episodes: [makeEpisode()] })).toBe(false);
  });

  it('execute: forwards the selected episodes to addToChat', async () => {
    const addToChat = jest.fn();
    const episodes = [makeEpisode(), makeEpisode({ 'episode.id': 'e2' })];

    await createAddToChatAction({ addToChat }).execute({ episodes });

    expect(addToChat).toHaveBeenCalledWith(episodes);
  });

  it('execute: is a no-op when addToChat is omitted', async () => {
    await expect(
      createAddToChatAction({}).execute({ episodes: [makeEpisode()] })
    ).resolves.toBeUndefined();
  });
});
