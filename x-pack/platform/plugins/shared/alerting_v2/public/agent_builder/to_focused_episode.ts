/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { AlertEpisode } from '@kbn/alerting-v2-schemas';
import { parseEpisodeDataJson } from '@kbn/alerting-v2-utils';
import type { FocusedEpisode } from './episode_auto_attach';

export interface CachedRuleDisplay {
  metadata?: { name?: string };
  grouping?: { fields?: readonly string[] } | null;
}

/**
 * Builds a focused episode for Agent Builder from a list-row episode and the
 * matching cached rule (same source as the episodes table rule column).
 */
export const toFocusedEpisode = (
  episode: AlertEpisode,
  rule?: CachedRuleDisplay
): FocusedEpisode => {
  const episodeData = parseEpisodeDataJson(episode.episode_data);
  const dataRuleName =
    typeof episodeData.rule_name === 'string' ? episodeData.rule_name : undefined;

  return {
    episode,
    ruleName: rule?.metadata?.name ?? dataRuleName,
    groupingFields: rule?.grouping?.fields,
  };
};
