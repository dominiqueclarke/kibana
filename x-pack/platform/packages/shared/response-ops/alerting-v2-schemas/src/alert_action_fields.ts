/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/**
 * V2 Alert Action field names
 * These fields are used in the .alerts-actions data stream
 */
export const ALERT_ACTION_FIELDS = {
  /** ISO timestamp */
  TIMESTAMP: '@timestamp',
  /** Timestamp of the last series event */
  LAST_SERIES_EVENT_TIMESTAMP: 'last_series_event_timestamp',
  /** Action expiry timestamp */
  EXPIRY: 'expiry',
  /** Actor who performed the action */
  ACTOR: 'actor',
  /** Type of action (e.g., fire-event) */
  ACTION_TYPE: 'action_type',
  /** Hash of the grouping key values */
  GROUP_HASH: 'group_hash',
  /** Episode identifier */
  EPISODE_ID: 'episode_id',
  /** Rule identifier */
  RULE_ID: 'rule_id',
  /** Source identifier */
  SOURCE: 'source',
} as const;
