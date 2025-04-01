/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useMemo } from 'react';
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
import { type RootWorkspaceState } from '@kbn/core-workspace-state';
import type { CaseUI } from '../../../common';
import { getManualAlertIds } from '../case_view/components/helpers';
import type { AttachmentUI } from '../../containers/types';
import { AttachmentType } from '../../../common/types/domain';
import { CaseViewAlertsEmpty } from '../case_view/components/case_view_alerts_empty';
import { useKibana, useDateFormat, useTimeZone } from '../../common/lib/kibana';

interface CaseViewAlertsProps {
  caseData: CaseUI;
}

export const getAttachedAlerts = (comments: AttachmentUI[]): AttachmentUI[] => {
  return comments.filter((comment: AttachmentUI) => comment.type === AttachmentType.alert);
};

export const formateDate = (date: string, format: string, timeZone: string) => {
  const strippedDateFormat = format.replace(/\.?SSS/, '');
  return moment.tz(date, timeZone).format(strippedDateFormat);
};

export const AttachedAlerts = ({ caseData }: CaseViewAlertsProps) => {
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
  const alertIdsQuery = useMemo(
    () => ({
      ids: {
        values: alertIds,
      },
    }),
    [alertIds]
  );
  const suggestedAlerts = useSelector<RootWorkspaceState>(
    (state) => state.cases.suggestedAlerts
  ) as RootWorkspaceState['cases']['suggestedAlerts'];
  const focusedAlert = suggestedAlerts.find((suggestedAlert) => suggestedAlert.isFocused) || null;

  const columns: Array<EuiBasicTableColumn<AttachmentUI>> = [
    {
      field: 'alertId',
      name: '',
      render: (alertId: string) => {
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
  ];

  const getRowProps = (alert: AttachmentUI & { alertId: string }) => {
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
        />
      )}
    </>
  );
};

AttachedAlerts.displayName = 'CaseAttachedAlerts';
