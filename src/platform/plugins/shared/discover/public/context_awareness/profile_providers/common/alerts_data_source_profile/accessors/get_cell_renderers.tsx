/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';
import { EuiBadge, EuiLink, EuiLoadingSpinner, EuiToolTip } from '@elastic/eui';
import {
  ALERT_EVENT_FIELDS,
  ALERT_EVENT_STATUS,
  ALERT_EVENT_TYPE,
  EPISODE_STATUS,
} from '@kbn/alerting-v2-schemas';
import type { DataGridCellValueElementProps } from '@kbn/unified-data-table';
import type { DataSourceProfileProvider } from '../../../../profiles';
import { getFieldValue, getNestedFieldValues } from '../utils';
import { useRuleInfo } from '../hooks';

// ============================================================================
// Test Subjects
// ============================================================================

const DATA_TEST_SUBJ = 'alertTypeBadgeCell';
const STATUS_DATA_TEST_SUBJ = 'alertStatusBadgeCell';
const EPISODE_STATUS_DATA_TEST_SUBJ = 'alertEpisodeStatusCell';
const RULE_ID_DATA_TEST_SUBJ = 'alertRuleIdCell';
const GROUP_HASH_DATA_TEST_SUBJ = 'alertGroupHashCell';

// ============================================================================
// Constants
// ============================================================================

const ALERTING_V2_RULE_EDIT_PATH = '/app/management/insightsAndAlerting/alerting_v2/edit';

/**
 * Cell renderer for the alert event type field.
 * Displays 'signal' or 'alert' as a colored badge.
 */
const getAlertTypeBadgeCell = (props: DataGridCellValueElementProps) => {
  const value = getFieldValue<string>(props.row, ALERT_EVENT_FIELDS.TYPE);

  if (!value) {
    return <span data-test-subj={`${DATA_TEST_SUBJ}-empty`}>-</span>;
  }

  const badgeConfig = getAlertTypeBadgeConfig(value);

  return (
    <EuiBadge color={badgeConfig.color} data-test-subj={DATA_TEST_SUBJ} css={{ marginTop: '-4px' }}>
      {badgeConfig.label}
    </EuiBadge>
  );
};

/**
 * Returns the badge configuration (color and label) for a given alert type.
 */
const getAlertTypeBadgeConfig = (type: string): { color: string; label: string } => {
  switch (type) {
    case ALERT_EVENT_TYPE.ALERT:
      return { color: 'primary', label: 'Alert' };
    case ALERT_EVENT_TYPE.SIGNAL:
      return { color: 'warning', label: 'Signal' };
    default:
      return { color: 'hollow', label: type };
  }
};

/**
 * Cell renderer for the alert event status field.
 * Displays 'breached' (red), 'recovered' (green), or 'no_data' as a colored badge.
 */
const getAlertStatusBadgeCell = (props: DataGridCellValueElementProps) => {
  const value = getFieldValue<string>(props.row, ALERT_EVENT_FIELDS.STATUS);

  if (!value) {
    return <span data-test-subj={`${STATUS_DATA_TEST_SUBJ}-empty`}>-</span>;
  }

  const badgeConfig = getAlertStatusBadgeConfig(value);

  return (
    <EuiBadge
      color={badgeConfig.color}
      data-test-subj={STATUS_DATA_TEST_SUBJ}
      css={{ marginTop: '-4px' }}
    >
      {badgeConfig.label}
    </EuiBadge>
  );
};

/**
 * Returns the badge configuration (color and label) for a given alert status.
 */
const getAlertStatusBadgeConfig = (status: string): { color: string; label: string } => {
  switch (status) {
    case ALERT_EVENT_STATUS.BREACHED:
      return { color: 'danger', label: 'Breached' };
    case ALERT_EVENT_STATUS.RECOVERED:
      return { color: 'success', label: 'Recovered' };
    case ALERT_EVENT_STATUS.NO_DATA:
      return { color: 'hollow', label: 'No Data' };
    default:
      return { color: 'hollow', label: status };
  }
};

/**
 * Cell renderer for the episode_status field.
 * Shows "N/A" for signal types (episode_status only applies to alerts).
 * Displays episode status as a colored badge for alert types.
 */
const getEpisodeStatusCell = (props: DataGridCellValueElementProps) => {
  const type = getFieldValue<string>(props.row, ALERT_EVENT_FIELDS.TYPE);
  const episodeStatus = getFieldValue<string>(props.row, ALERT_EVENT_FIELDS.EPISODE_STATUS);

  // Episode status is not applicable for signal types
  if (type === ALERT_EVENT_TYPE.SIGNAL || !episodeStatus) {
    return (
      <span
        data-test-subj={`${EPISODE_STATUS_DATA_TEST_SUBJ}-na`}
        css={({ euiTheme }) => ({ color: euiTheme.colors.subduedText, fontStyle: 'italic' })}
      >
        N/A
      </span>
    );
  }

  const badgeConfig = getEpisodeStatusBadgeConfig(episodeStatus);

  return (
    <EuiBadge
      color={badgeConfig.color}
      data-test-subj={EPISODE_STATUS_DATA_TEST_SUBJ}
      css={{ marginTop: '-4px' }}
    >
      {badgeConfig.label}
    </EuiBadge>
  );
};

/**
 * Returns the badge configuration (color and label) for a given episode status.
 */
const getEpisodeStatusBadgeConfig = (status: string): { color: string; label: string } => {
  switch (status) {
    case EPISODE_STATUS.ACTIVE:
      return { color: 'danger', label: 'Active' };
    case EPISODE_STATUS.RECOVERING:
      return { color: 'warning', label: 'Recovering' };
    case EPISODE_STATUS.PENDING:
      return { color: 'primary', label: 'Pending' };
    case EPISODE_STATUS.INACTIVE:
      return { color: 'hollow', label: 'Inactive' };
    default:
      return { color: 'hollow', label: status };
  }
};

/**
 * Cell renderer for the rule.id field.
 * Fetches the rule name and displays it as a clickable link to the rule edit page.
 */
function RuleIdCell(props: DataGridCellValueElementProps) {
  const ruleId = getFieldValue<string>(props.row, ALERT_EVENT_FIELDS.RULE_ID);
  const { ruleInfo, isLoading } = useRuleInfo(ruleId);

  if (!ruleId) {
    return <span data-test-subj={`${RULE_ID_DATA_TEST_SUBJ}-empty`}>-</span>;
  }

  const ruleEditUrl = `${ALERTING_V2_RULE_EDIT_PATH}/${ruleId}`;

  if (isLoading) {
    return (
      <span data-test-subj={`${RULE_ID_DATA_TEST_SUBJ}-loading`}>
        <EuiLoadingSpinner size="s" /> {ruleId}
      </span>
    );
  }

  // Show rule ID as plain text, rule name as hyperlink in parentheses
  return (
    <span data-test-subj={RULE_ID_DATA_TEST_SUBJ}>
      <span css={{ fontFamily: 'monospace', fontSize: '0.9em' }}>{ruleId}</span>
      {ruleInfo?.name && (
        <span css={({ euiTheme }) => ({ marginLeft: euiTheme.size.s })}>
          (<EuiLink href={ruleEditUrl}>{ruleInfo.name}</EuiLink>)
        </span>
      )}
    </span>
  );
}

/**
 * Builds tooltip content showing the grouping field values that comprise the hash.
 */
function buildGroupingTooltipContent(
  _hash: string,
  entries: Array<{ field: string; value: string }>
) {
  return (
    <>
      <div css={{ marginBottom: '8px' }}>
        <strong>Grouping Values:</strong>
      </div>
      {entries.map((entry) => (
        <div key={entry.field} css={{ marginBottom: '4px' }}>
          <span css={{ opacity: 0.7 }}>{entry.field}:</span> <strong>{entry.value}</strong>
        </div>
      ))}
      <div
        css={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}
      >
        <span css={{ opacity: 0.7, fontSize: '0.9em' }}>
          This hash uniquely identifies alerts with these grouping values.
        </span>
      </div>
    </>
  );
}

/**
 * Renders a styled field-value pair for the grouping values display.
 */
function GroupingFieldValue({ field, value }: { field: string; value: string }) {
  return (
    <span css={{ display: 'inline' }}>
      <span
        css={({ euiTheme }) => ({
          color: euiTheme.colors.subduedText,
          fontSize: '0.85em',
        })}
      >
        {field}:
      </span>{' '}
      <span
        css={({ euiTheme }) => ({
          fontWeight: euiTheme.font.weight.medium,
        })}
      >
        {value}
      </span>
    </span>
  );
}

/**
 * Cell renderer for the group_hash field.
 * Displays the hash as the primary value with grouping field values below.
 */
function GroupHashCell(props: DataGridCellValueElementProps) {
  const ruleId = getFieldValue<string>(props.row, ALERT_EVENT_FIELDS.RULE_ID);
  const groupHash = getFieldValue<string>(props.row, ALERT_EVENT_FIELDS.GROUP_HASH);
  const data = getNestedFieldValues(props.row, ALERT_EVENT_FIELDS.DATA);
  const { ruleInfo, isLoading } = useRuleInfo(ruleId);

  if (!groupHash) {
    return <span data-test-subj={`${GROUP_HASH_DATA_TEST_SUBJ}-empty`}>-</span>;
  }

  if (isLoading) {
    return (
      <div data-test-subj={`${GROUP_HASH_DATA_TEST_SUBJ}-loading`}>
        <div css={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{groupHash}</div>
        <div css={{ marginTop: '4px' }}>
          <EuiLoadingSpinner size="s" />
        </div>
      </div>
    );
  }

  // Build grouping entries from data
  let groupingEntries: Array<{ field: string; value: string }> = [];

  const groupingKey = ruleInfo?.groupingKey ?? [];
  if (groupingKey.length > 0 && data) {
    // Use rule's groupingKey to determine which fields to show
    groupingEntries = groupingKey
      .map((key) => {
        const value = data[key];
        // Only include if value exists and is not empty
        if (value !== undefined && value !== null && value !== '') {
          return { field: key, value: String(value) };
        }
        return null;
      })
      .filter((entry): entry is { field: string; value: string } => entry !== null);
  } else if (data && Object.keys(data).length > 0) {
    // Fallback to all data fields if no groupingKey (already filtered for valid values)
    groupingEntries = Object.entries(data)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => ({
        field: key,
        value: String(value),
      }));
  }

  // If we have grouping data, show hash with grouping values below
  if (groupingEntries.length > 0) {
    return (
      <EuiToolTip content={buildGroupingTooltipContent(groupHash, groupingEntries)}>
        <div tabIndex={0} data-test-subj={GROUP_HASH_DATA_TEST_SUBJ} css={{ cursor: 'help' }}>
          <div css={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{groupHash}</div>
          <div css={({ euiTheme }) => ({ marginTop: '4px', fontSize: '0.9em' })}>
            {groupingEntries.map((entry, index) => (
              <React.Fragment key={entry.field}>
                {index > 0 && (
                  <span css={({ euiTheme }) => ({ color: euiTheme.colors.subduedText })}>, </span>
                )}
                <GroupingFieldValue field={entry.field} value={entry.value} />
              </React.Fragment>
            ))}
          </div>
        </div>
      </EuiToolTip>
    );
  }

  // Fallback: just show hash without grouping values
  return (
    <div
      data-test-subj={`${GROUP_HASH_DATA_TEST_SUBJ}-hash`}
      css={{ fontFamily: 'monospace', fontSize: '0.85em' }}
    >
      {groupHash}
    </div>
  );
}

/**
 * Returns the cell renderers for the alerts data source profile.
 */
export const getCellRenderers: DataSourceProfileProvider['profile']['getCellRenderers'] =
  (prev) => (params) => ({
    ...prev(params),
    [ALERT_EVENT_FIELDS.STATUS]: getAlertStatusBadgeCell,
    [ALERT_EVENT_FIELDS.TYPE]: getAlertTypeBadgeCell,
    [ALERT_EVENT_FIELDS.EPISODE_STATUS]: getEpisodeStatusCell,
    [ALERT_EVENT_FIELDS.RULE_ID]: RuleIdCell,
    [ALERT_EVENT_FIELDS.GROUP_HASH]: GroupHashCell,
  });
