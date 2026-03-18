/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { ALERT_EVENT_FIELDS } from '@kbn/alerting-v2-schemas';

/**
 * Profile ID for the alerts data source profile
 */
export const ALERTS_PROFILE_ID = 'alerts-data-source-profile';

/**
 * Index pattern prefixes for V2 alert data streams
 * Used for matching in the profile resolver
 */
export const ALERT_EVENTS_INDEX_PREFIX = '.alerts-events';
export const ALERT_ACTIONS_INDEX_PREFIX = '.alerts-actions';

/**
 * Default columns for the alerts data source profile
 */
export const DEFAULT_ALERT_COLUMNS: Array<{ name: string; width?: number }> = [
  { name: ALERT_EVENT_FIELDS.TIMESTAMP, width: 212 },
  { name: ALERT_EVENT_FIELDS.STATUS, width: 120 },
  { name: ALERT_EVENT_FIELDS.TYPE, width: 100 },
  { name: ALERT_EVENT_FIELDS.RULE_ID, width: 200 },
  { name: ALERT_EVENT_FIELDS.EPISODE_STATUS, width: 130 },
  { name: ALERT_EVENT_FIELDS.GROUP_HASH, width: 200 },
];

/**
 * Recommended fields to display in the field list sidebar
 */
export const RECOMMENDED_ALERT_FIELDS = [
  ALERT_EVENT_FIELDS.STATUS,
  ALERT_EVENT_FIELDS.TYPE,
  ALERT_EVENT_FIELDS.RULE_ID,
  ALERT_EVENT_FIELDS.EPISODE_STATUS,
  ALERT_EVENT_FIELDS.EPISODE_ID,
  ALERT_EVENT_FIELDS.GROUP_HASH,
  ALERT_EVENT_FIELDS.SCHEDULED_TIMESTAMP,
  ALERT_EVENT_FIELDS.SOURCE,
  ALERT_EVENT_FIELDS.DATA,
];
