/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { type ComponentType, useMemo } from 'react';
import { css } from '@emotion/react';
import moment from 'moment';
import {
  EuiFlexItem,
  EuiFlexGroup,
  type EuiBasicTableColumn,
  EuiBasicTable,
  EuiBadge,
  EuiButtonIcon,
  EuiTitle,
  EuiSpacer,
  useEuiTheme,
} from '@elastic/eui';
import { useSelector } from 'react-redux';
// import type { SetRequired } from 'type-fest';
import type { CaseViewAlertsTableProps } from '../case_view/types';
import { SECURITY_SOLUTION_OWNER } from '../../../common/constants';
import type { CaseUI } from '../../../common';
import { getManualAlertIds } from '../case_view/components/helpers';
import { useGetFeatureIds } from '../../containers/use_get_feature_ids';
import type { AttachmentUI } from '../../containers/types';
import { AttachmentType } from '../../../common/types/domain';
import { CaseViewAlertsEmpty } from '../case_view/components/case_view_alerts_empty';
// import { CaseViewTabs } from '../case_view/case_view_tabs';
// import { CASE_VIEW_PAGE_TABS } from '../../../common/types';
import { useKibana, useDateFormat, useTimeZone } from '../../common/lib/kibana';

interface CaseViewAlertsProps {
  caseData: CaseUI;
  onAlertsTableLoaded?: (eventIds: Array<Partial<{ _id: string }>>) => void;
  renderAlertsTable?: ComponentType<CaseViewAlertsTableProps>;
}

export const getAttachedAlerts = (comments: AttachmentUI[]): AttachmentUI[] => {
  return comments.filter((comment: AttachmentUI) => comment.type === AttachmentType.alert);
};

export const formateDate = (date: string, format: string, timeZone: string) => {
  const strippedDateFormat = format.replace(/\.?SSS/, '');
  return moment.tz(date, timeZone).format(strippedDateFormat);
};

export const AttachedAlerts = ({
  caseData,
  renderAlertsTable: CustomAlertsTable,
  onAlertsTableLoaded,
}: CaseViewAlertsProps) => {
  const { euiTheme } = useEuiTheme();
  const {
    services: {
      http: { basePath },
    },
  } = useKibana();
  const systemDateFormat = useDateFormat();
  const timeZone = useTimeZone();
  const alertIds = getManualAlertIds(caseData.comments);
  const alertAttachments = getAttachedAlerts(caseData.comments);
  console.log('alertAttachments', alertAttachments);
  const alertIdsQuery = useMemo(
    () => ({
      ids: {
        values: alertIds,
      },
    }),
    [alertIds]
  );
  const suggestedAlerts = useSelector((state) => state.cases.suggestedAlerts);
  const focusedAlert = suggestedAlerts.find((suggestedAlert) => suggestedAlert.isFocused) || null;

  const { isLoading: isLoadingAlertFeatureIds, data: alertData } = useGetFeatureIds(
    alertIds,
    caseData.owner !== SECURITY_SOLUTION_OWNER
  );
  console.log('alertData', alertData);

  const columns: Array<EuiBasicTableColumn<any>> = [
    {
      field: 'alertId',
      name: '',
      ariaLabel: 'Alert details',
      render: (alertId: string) => {
        console.log('alertId', alertId);
        return (
          <EuiButtonIcon
            iconType="expand"
            aria-label="View alert details"
            href={basePath.prepend(`/app/observability/alerts/${alertId?.[0]}`)}
          />
        );
      },
      width: '15%',
    },
    {
      field: 'status',
      name: 'Status',
      'data-test-subj': 'statusCell',
      render: (status: string) => {
        return <EuiBadge color={'danger'}>{'Active'}</EuiBadge>;
      },
      width: '20%',
    },
    // {
    //   field: 'rule',
    //   name: 'Rule name',
    //   'data-test-subj': 'ruleCell',
    //   render: (rule: string) => {
    //     return rule.name;
    //   },
    // },
    {
      field: 'createdAt',
      name: 'Triggered At',
      truncateText: true,
      render: (createdAt: string) => {
        return formateDate(createdAt, systemDateFormat, timeZone);
      },
      mobileOptions: {
        width: '100%',
      },
    },
    // {
    //   field: 'dateOfBirth',
    //   name: 'Date of Birth',
    //   dataType: 'date',
    //   render: (dateOfBirth: User['dateOfBirth']) => formatDate(dateOfBirth, 'dobLong'),
    // },
    // {
    //   field: 'location',
    //   name: 'Location',
    //   truncateText: true,
    //   textOnly: true,
    //   render: (location: User['location']) => {
    //     return `${location.city}, ${location.country}`;
    //   },
    // },
    // {
    //   field: 'online',
    //   name: 'Online',
    //   dataType: 'boolean',
    //   render: (online: User['online']) => {
    //     const color = online ? 'success' : 'danger';
    //     const label = online ? 'Online' : 'Offline';
    //     return <EuiHealth color={color}>{label}</EuiHealth>;
    //   },
    // },
  ];

  const getRowProps = (alert: any) => {
    const { alertId } = alert;
    const id = alertId?.[0];
    const isAlertFocused = focusedAlert?.id === id;
    return {
      'data-test-subj': `row-${id}`,
      css: isAlertFocused
        ? css`
            background-color: ${euiTheme.colors.backgroundBaseHighlighted};
          `
        : undefined,
    };
  };

  return (
    <>
      <EuiTitle size="xs">
        <h4>{'Alerts'}</h4>
      </EuiTitle>
      <EuiSpacer size="s" />
      {alertIdsQuery.ids.values.length === 0 ? (
        <EuiFlexGroup>
          <EuiFlexItem>
            <CaseViewAlertsEmpty />
          </EuiFlexItem>
        </EuiFlexGroup>
      ) : (
        <EuiBasicTable
          tableCaption="Demo of EuiBasicTable"
          items={alertAttachments}
          rowHeader="firstName"
          columns={columns}
          rowProps={getRowProps}
          //   responsiveBreakpoint={true}
        />
      )}
    </>
  );
};

AttachedAlerts.displayName = 'CaseAttachedAlerts';
