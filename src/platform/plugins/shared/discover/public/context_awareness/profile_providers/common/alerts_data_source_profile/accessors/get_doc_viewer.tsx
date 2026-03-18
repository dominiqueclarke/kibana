/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';
import {
  EuiBadge,
  EuiCodeBlock,
  EuiDescriptionList,
  EuiFlexGroup,
  EuiFlexItem,
  EuiHorizontalRule,
  EuiLink,
  EuiLoadingSpinner,
  EuiPanel,
  EuiSpacer,
  EuiText,
  EuiTitle,
} from '@elastic/eui';
import {
  ALERT_EVENT_FIELDS,
  ALERT_EVENT_STATUS,
  ALERT_EVENT_TYPE,
  EPISODE_STATUS,
} from '@kbn/alerting-v2-schemas';
import { i18n } from '@kbn/i18n';
import type { DocViewRenderProps } from '@kbn/unified-doc-viewer/types';
import type { DataSourceProfileProvider } from '../../../../profiles';
import { getFieldValue, getNestedFieldValues } from '../utils';
import { useRuleInfo } from '../hooks';

const ALERTING_V2_RULE_EDIT_PATH = '/app/management/insightsAndAlerting/alerting_v2/edit';

/**
 * Creates the getDocViewer accessor for the alerts data source profile.
 * Adds a custom "Alert Overview" tab to the document flyout.
 */
export const getDocViewer: DataSourceProfileProvider['profile']['getDocViewer'] =
  (prev) => (params) => {
    const prevDocViewer = prev(params);

    return {
      ...prevDocViewer,
      title: i18n.translate('discover.context.alerts.docViewer.title', {
        defaultMessage: 'Alert Details',
      }),
      docViewsRegistry: (registry) => {
        registry.add({
          id: 'doc_view_alert_overview',
          title: i18n.translate('discover.docViews.alertOverview.title', {
            defaultMessage: 'Alert overview',
          }),
          order: 0,
          render: (props: DocViewRenderProps) => <AlertOverviewTab {...props} />,
        });

        return prevDocViewer.docViewsRegistry(registry);
      },
    };
  };

/**
 * Returns the badge color for a given alert status.
 */
const getStatusBadgeColor = (status: string): string => {
  switch (status) {
    case ALERT_EVENT_STATUS.BREACHED:
      return 'danger';
    case ALERT_EVENT_STATUS.RECOVERED:
      return 'success';
    case ALERT_EVENT_STATUS.NO_DATA:
      return 'hollow';
    default:
      return 'hollow';
  }
};

/**
 * Returns the badge color for a given alert type.
 */
const getTypeBadgeColor = (type: string): string => {
  switch (type) {
    case ALERT_EVENT_TYPE.ALERT:
      return 'primary';
    case ALERT_EVENT_TYPE.SIGNAL:
      return 'warning';
    default:
      return 'hollow';
  }
};

/**
 * Returns the badge color for a given episode status.
 */
const getEpisodeStatusBadgeColor = (status: string): string => {
  switch (status) {
    case EPISODE_STATUS.ACTIVE:
      return 'danger';
    case EPISODE_STATUS.RECOVERING:
      return 'warning';
    case EPISODE_STATUS.PENDING:
      return 'primary';
    case EPISODE_STATUS.INACTIVE:
      return 'hollow';
    default:
      return 'hollow';
  }
};

/**
 * Alert Overview Tab component for the document flyout.
 */
const AlertOverviewTab = ({ hit }: DocViewRenderProps) => {
  // Extract alert fields using helpers
  const timestamp = getFieldValue<string>(hit, ALERT_EVENT_FIELDS.TIMESTAMP);
  const status = getFieldValue<string>(hit, ALERT_EVENT_FIELDS.STATUS);
  const type = getFieldValue<string>(hit, ALERT_EVENT_FIELDS.TYPE);
  const ruleId = getFieldValue<string>(hit, ALERT_EVENT_FIELDS.RULE_ID);
  const groupHash = getFieldValue<string>(hit, ALERT_EVENT_FIELDS.GROUP_HASH);
  const episodeId = getFieldValue<string>(hit, ALERT_EVENT_FIELDS.EPISODE_ID);
  const episodeStatus = getFieldValue<string>(hit, ALERT_EVENT_FIELDS.EPISODE_STATUS);
  const scheduledTimestamp = getFieldValue<string>(hit, ALERT_EVENT_FIELDS.SCHEDULED_TIMESTAMP);
  const source = getFieldValue<string>(hit, ALERT_EVENT_FIELDS.SOURCE);

  // Extract all data fields from the document
  const allDataFields = getNestedFieldValues(hit, ALERT_EVENT_FIELDS.DATA) ?? {};

  // Fetch rule info (name and groupingKey) for display
  const { ruleInfo, isLoading: isLoadingRuleInfo } = useRuleInfo(ruleId);
  const ruleEditUrl = ruleId ? `${ALERTING_V2_RULE_EDIT_PATH}/${ruleId}` : undefined;

  // Filter data fields to only show actual grouping fields
  const groupingFields: Record<string, unknown> = {};
  if (ruleInfo?.groupingKey && ruleInfo.groupingKey.length > 0 && allDataFields) {
    // Only include fields that are in the rule's groupingKey
    for (const key of ruleInfo.groupingKey) {
      if (key in allDataFields) {
        groupingFields[key] = allDataFields[key];
      }
    }
  }

  // Build the rule description element
  const getRuleDescription = () => {
    if (!ruleId) return '-';
    if (isLoadingRuleInfo) {
      return (
        <span>
          <EuiLoadingSpinner size="s" /> {ruleId}
        </span>
      );
    }
    if (ruleInfo?.name && ruleEditUrl) {
      return <EuiLink href={ruleEditUrl}>{ruleInfo.name}</EuiLink>;
    }
    return ruleEditUrl ? <EuiLink href={ruleEditUrl}>{ruleId}</EuiLink> : ruleId;
  };

  return (
    <EuiPanel paddingSize="l" hasShadow={false} hasBorder={false}>
      {/* Status and Type Header */}
      <EuiFlexGroup gutterSize="m" alignItems="center">
        {status && (
          <EuiFlexItem grow={false}>
            <EuiBadge color={getStatusBadgeColor(status)}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </EuiBadge>
          </EuiFlexItem>
        )}
        {type && (
          <EuiFlexItem grow={false}>
            <EuiBadge color={getTypeBadgeColor(type)}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </EuiBadge>
          </EuiFlexItem>
        )}
        {episodeStatus && type === ALERT_EVENT_TYPE.ALERT && (
          <EuiFlexItem grow={false}>
            <EuiBadge color={getEpisodeStatusBadgeColor(episodeStatus)}>
              Episode: {episodeStatus.charAt(0).toUpperCase() + episodeStatus.slice(1)}
            </EuiBadge>
          </EuiFlexItem>
        )}
      </EuiFlexGroup>

      <EuiSpacer size="l" />

      {/* Alert Details */}
      <EuiTitle size="xs">
        <h3>
          {i18n.translate('discover.docViews.alertOverview.details.title', {
            defaultMessage: 'Alert Details',
          })}
        </h3>
      </EuiTitle>
      <EuiSpacer size="s" />
      <EuiDescriptionList
        type="column"
        columnWidths={[1, 3]}
        compressed
        listItems={[
          {
            title: i18n.translate('discover.docViews.alertOverview.timestamp', {
              defaultMessage: 'Timestamp',
            }),
            description: timestamp ? new Date(timestamp).toLocaleString() : '-',
          },
          {
            title: i18n.translate('discover.docViews.alertOverview.scheduledTimestamp', {
              defaultMessage: 'Scheduled At',
            }),
            description: scheduledTimestamp ? new Date(scheduledTimestamp).toLocaleString() : '-',
          },
          {
            title: i18n.translate('discover.docViews.alertOverview.ruleId', {
              defaultMessage: 'Rule',
            }),
            description: getRuleDescription(),
          },
          {
            title: i18n.translate('discover.docViews.alertOverview.source', {
              defaultMessage: 'Source',
            }),
            description: source || '-',
          },
        ]}
      />

      {/* Episode Information (only for alert type) */}
      {type === ALERT_EVENT_TYPE.ALERT && episodeId && (
        <>
          <EuiHorizontalRule margin="l" />
          <EuiTitle size="xs">
            <h3>
              {i18n.translate('discover.docViews.alertOverview.episode.title', {
                defaultMessage: 'Episode Information',
              })}
            </h3>
          </EuiTitle>
          <EuiSpacer size="s" />
          <EuiDescriptionList
            type="column"
            columnWidths={[1, 3]}
            compressed
            listItems={[
              {
                title: i18n.translate('discover.docViews.alertOverview.episodeId', {
                  defaultMessage: 'Episode ID',
                }),
                description: (
                  <EuiText size="s" css={{ fontFamily: 'monospace' }}>
                    {episodeId}
                  </EuiText>
                ),
              },
              {
                title: i18n.translate('discover.docViews.alertOverview.episodeStatus', {
                  defaultMessage: 'Episode Status',
                }),
                description: episodeStatus ? (
                  <EuiBadge color={getEpisodeStatusBadgeColor(episodeStatus)}>
                    {episodeStatus.charAt(0).toUpperCase() + episodeStatus.slice(1)}
                  </EuiBadge>
                ) : (
                  '-'
                ),
              },
            ]}
          />
        </>
      )}

      {/* Group Hash */}
      <EuiHorizontalRule margin="l" />
      <EuiTitle size="xs">
        <h3>
          {i18n.translate('discover.docViews.alertOverview.grouping.title', {
            defaultMessage: 'Alert Grouping',
          })}
        </h3>
      </EuiTitle>
      <EuiSpacer size="s" />
      <EuiDescriptionList
        type="column"
        columnWidths={[1, 3]}
        compressed
        listItems={[
          {
            title: i18n.translate('discover.docViews.alertOverview.groupHash', {
              defaultMessage: 'Group Hash',
            }),
            description: (
              <EuiText size="s" css={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {groupHash || '-'}
              </EuiText>
            ),
          },
        ]}
      />

      {/* Grouping Values - only shows fields defined in rule's groupingKey */}
      {Object.keys(groupingFields).length > 0 && (
        <>
          <EuiSpacer size="m" />
          <EuiTitle size="xxs">
            <h4>
              {i18n.translate('discover.docViews.alertOverview.groupingValues.title', {
                defaultMessage: 'Grouping Values',
              })}
            </h4>
          </EuiTitle>
          <EuiSpacer size="s" />
          <EuiDescriptionList
            type="column"
            columnWidths={[1, 3]}
            compressed
            listItems={Object.entries(groupingFields).map(([field, value]) => ({
              title: field,
              description: String(value),
            }))}
          />
        </>
      )}

      {/* Alert Data - full data object from the ES|QL query */}
      {Object.keys(allDataFields).length > 0 && (
        <>
          <EuiHorizontalRule margin="l" />
          <EuiTitle size="xs">
            <h3>
              {i18n.translate('discover.docViews.alertOverview.alertData.title', {
                defaultMessage: 'Alert Data',
              })}
            </h3>
          </EuiTitle>
          <EuiSpacer size="s" />
          <EuiCodeBlock language="json" fontSize="s" paddingSize="m" isCopyable>
            {JSON.stringify(allDataFields, null, 2)}
          </EuiCodeBlock>
        </>
      )}
    </EuiPanel>
  );
};
