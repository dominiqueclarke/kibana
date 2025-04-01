/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { css } from '@emotion/react';
import { useSelector } from 'react-redux';
import {
  useEuiTheme,
  EuiLink,
  type EuiBasicTableColumn,
  EuiBasicTable,
  EuiTitle,
  EuiSpacer,
} from '@elastic/eui';
import { type Dashboard, type RootWorkspaceState } from '@kbn/core-workspace-state';
import type { SetRequired } from 'type-fest';
import { useKibana } from '../../common/lib/kibana';

export const AttachedDashboards = () => {
  const { euiTheme } = useEuiTheme();
  const { services } = useKibana();
  const {
    http: { basePath },
  } = services as SetRequired<typeof services, 'licensing'>;

  const dashboards = useSelector<RootWorkspaceState>(
    (state) => state.cases.dashboards
  ) as Dashboard[];
  const suggestedDashboards =
    (useSelector<RootWorkspaceState>((state) => state.cases.suggestedDashboards) as Dashboard[]) ||
    [];
  const focusedDashboard =
    suggestedDashboards.find((suggestedDashboard) => suggestedDashboard.isFocused) || null;

  const columns: Array<EuiBasicTableColumn<Dashboard>> = [
    {
      name: 'Title',
      render: (dashboard: Dashboard) => {
        return (
          <EuiLink href={basePath.prepend(`/app/dashboards#/view/${dashboard.id}`)}>
            {dashboard.title}
          </EuiLink>
        );
      },
    },
  ];

  const getRowProps = (dashboard: Dashboard) => {
    const { id } = dashboard;
    const isDashboardFocused = focusedDashboard?.id === id;
    return {
      'data-test-subj': `row-${id}`,
      css: isDashboardFocused
        ? css`
            background-color: ${euiTheme.colors.backgroundBaseHighlighted};
          `
        : undefined,
    };
  };

  return (
    <>
      <EuiTitle size="xs">
        <h4>{'Dashboards'}</h4>
      </EuiTitle>
      <EuiSpacer size="s" />
      <EuiBasicTable
        tableCaption="Demo of EuiBasicTable"
        items={dashboards}
        rowHeader="firstName"
        columns={columns}
        rowProps={getRowProps}
      />
    </>
  );
};

AttachedDashboards.displayName = 'CaseAttachedDashboards';
