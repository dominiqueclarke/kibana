/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { AlertEpisode } from '@kbn/alerting-v2-schemas';
import type { EpisodeAction, EpisodeActionContext } from './types';
import * as i18n from './translations';

export const ADD_TO_CHAT_EPISODE_ACTION_ID = 'ALERTING_V2_ADD_EPISODE_TO_CHAT';

export interface AddToChatActionDeps {
  /**
   * Opens Agent Builder with the selected episodes attached. Omit when Agent Builder
   * is unavailable; the action then reports as incompatible for every selection.
   */
  addToChat?: (episodes: AlertEpisode[]) => void | Promise<void>;
}

export const createAddToChatAction = (deps: AddToChatActionDeps): EpisodeAction => ({
  id: ADD_TO_CHAT_EPISODE_ACTION_ID,
  order: 60,
  displayName: i18n.ADD_TO_CHAT,
  iconType: 'productAgent',
  isCompatible: ({ episodes }: EpisodeActionContext) =>
    Boolean(deps.addToChat) && episodes.length > 0,
  execute: async ({ episodes }: EpisodeActionContext) => {
    await deps.addToChat?.(episodes);
  },
});
