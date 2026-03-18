/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { DataSourceProfileProvider } from '../../../profiles';
import { DataSourceCategory } from '../../../profiles';
import { extractIndexPatternFrom } from '../../extract_index_pattern_from';
import {
  ALERTS_PROFILE_ID,
  ALERT_EVENTS_INDEX_PREFIX,
  ALERT_ACTIONS_INDEX_PREFIX,
  DEFAULT_ALERT_COLUMNS,
  RECOMMENDED_ALERT_FIELDS,
} from './constants';
import { getCellRenderers, getDocViewer } from './accessors';

/**
 * Creates the alerts data source profile provider for V2 alerting.
 * This profile provides a curated experience when exploring V2 alerts in Discover.
 *
 * The profile resolves when querying V2 alert data streams:
 * - `.alerts-events` - Alert event records
 * - `.alerts-actions` - Alert action records
 *
 * @returns The alerts data source profile provider
 */
export const createAlertsDataSourceProfileProvider = (): DataSourceProfileProvider => ({
  profileId: ALERTS_PROFILE_ID,
  isExperimental: true,
  profile: {
    /**
     * Sets default columns optimized for V2 alert exploration
     */
    getDefaultAppState: (prev) => (params) => {
      const prevState = prev(params);

      return {
        ...prevState,
        columns: DEFAULT_ALERT_COLUMNS,
      };
    },

    /**
     * Adds V2 alert-specific fields to the recommended fields section
     */
    getRecommendedFields: (prev) => () => ({
      ...prev(),
      recommendedFields: RECOMMENDED_ALERT_FIELDS,
    }),

    /**
     * Custom cell renderers for alert-specific fields
     */
    getCellRenderers,

    /**
     * Custom document flyout with an "Alert Overview" tab
     */
    getDocViewer,
  },
  resolve: (params) => {
    const indexPattern = extractIndexPatternFrom(params);

    if (!isAlertV2IndexPattern(indexPattern)) {
      return { isMatch: false };
    }

    return {
      isMatch: true,
      context: {
        category: DataSourceCategory.Default,
      },
    };
  },
});

const isAlertV2IndexPattern = (indexPattern: string | null): boolean => {
  if (!indexPattern) {
    return false;
  }

  const patterns = indexPattern.split(',').map((p) => p.trim());

  return patterns.some(
    (pattern) =>
      pattern.startsWith(ALERT_EVENTS_INDEX_PREFIX) ||
      pattern.startsWith(ALERT_ACTIONS_INDEX_PREFIX)
  );
};
