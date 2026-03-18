/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/**
 * V2 Alert Event field names
 * These fields are used in the .alerts-events data stream
 */
export const ALERT_EVENT_FIELDS = {
  /** ISO timestamp when the alert event was written */
  TIMESTAMP: '@timestamp',
  /** ISO timestamp when the rule execution was scheduled */
  SCHEDULED_TIMESTAMP: 'scheduled_timestamp',
  /** Rule identifier */
  RULE_ID: 'rule.id',
  /** Rule version */
  RULE_VERSION: 'rule.version',
  /** Hash of the grouping key values */
  GROUP_HASH: 'group_hash',
  /** Object containing the alert data from the query */
  DATA: 'data',
  /** Alert status: breached | recovered | no_data */
  STATUS: 'status',
  /** Source identifier */
  SOURCE: 'source',
  /** Alert type: signal | alert */
  TYPE: 'type',
  /** Episode identifier (alert type only) */
  EPISODE_ID: 'episode.id',
  /** Episode status: inactive | pending | active | recovering (alert type only) */
  EPISODE_STATUS: 'episode.status',
} as const;

/**
 * Alert event status values
 */
export const ALERT_EVENT_STATUS = {
  BREACHED: 'breached',
  RECOVERED: 'recovered',
  NO_DATA: 'no_data',
} as const;

/**
 * Alert event type values
 */
export const ALERT_EVENT_TYPE = {
  SIGNAL: 'signal',
  ALERT: 'alert',
} as const;

/**
 * Episode status values (for alert type events)
 */
export const EPISODE_STATUS = {
  INACTIVE: 'inactive',
  PENDING: 'pending',
  ACTIVE: 'active',
  RECOVERING: 'recovering',
} as const;

export type AlertEventStatus = (typeof ALERT_EVENT_STATUS)[keyof typeof ALERT_EVENT_STATUS];
export type AlertEventType = (typeof ALERT_EVENT_TYPE)[keyof typeof ALERT_EVENT_TYPE];
export type EpisodeStatus = (typeof EPISODE_STATUS)[keyof typeof EPISODE_STATUS];
