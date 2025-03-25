/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  EuiButton,
  EuiSpacer,
  EuiTitle,
  EuiFlexGroup,
  EuiFlexItem,
  EuiEmptyPrompt,
} from '@elastic/eui';
import { type Dashboard, type RootWorkspaceState } from '@kbn/core-workspace-state';
import { useKibana } from '../../common/lib/kibana';
import type { CaseUI } from '../../../common';

interface AttachmentsProps {
  caseData: CaseUI;
}

export const SuggestedAttachments: React.FC<AttachmentsProps> = ({
  caseData,
}: AttachmentsProps) => {
  const {
    services: {
      chrome: {
        workspace: { cases },
      },
    },
  } = useKibana();
  console.log('casesServices', cases);
  const suggestedAlerts = useSelector<RootWorkspaceState>((state) => state.cases.suggestedAlerts);
  const suggestedDashboards = useSelector<RootWorkspaceState>(
    (state) => state.cases.suggestedDashboards
  );
  const suggestedDiscoverSessions = useSelector<RootWorkspaceState>(
    (state) => state.cases.suggestedDiscoverSessions
  );
  console.log('caseData.comments', caseData.comments);
  const dashboards = useSelector<RootWorkspaceState>(
    (state) => state.cases.dashboards
  ) as Dashboard[];
  const filteredSuggestedAlerts = suggestedAlerts.filter(
    (alert) =>
      !caseData.comments.some((comment) => {
        console.log('comment.alertId', comment.alertId);
        console.log('alert.id', alert.id);
        return comment.alertId?.[0] === alert.id;
      })
  );
  const filteredSuggestedDashboards = useMemo(
    () => suggestedDashboards.filter((dashboard) => !dashboards.some((d) => d.id === dashboard.id)),
    [dashboards, suggestedDashboards]
  );
  console.log('dashboards in suggested attachments', dashboards);
  console.log('filteredSuggestedAlerts', filteredSuggestedAlerts);
  console.log('filteredSuggestedDashboards', filteredSuggestedDashboards);
  const noSuggestions =
    !filteredSuggestedAlerts.length &&
    !filteredSuggestedDashboards.length &&
    !suggestedDiscoverSessions.length;

  return (
    <div>
      <EuiTitle size="s">
        <h4>{'On this page'}</h4>
      </EuiTitle>
      <EuiSpacer size="s" />
      {noSuggestions ? (
        <EuiEmptyPrompt
          data-test-subj="caseViewAlertsEmpty"
          iconType="casesApp"
          iconColor="default"
          titleSize="xs"
          body={<p>{'No attachment suggestions available.'}</p>}
        />
      ) : null}
      {filteredSuggestedAlerts.length ? (
        <>
          <EuiTitle size="xxs">
            <h5>{'Alerts'}</h5>
          </EuiTitle>
          {filteredSuggestedAlerts.map((alert) => {
            return (
              <>
                <EuiFlexGroup alignItems="baseline">
                  <EuiFlexItem>
                    <div key={alert.id}>{alert.name}</div>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiButton>{'Add alert'}</EuiButton>
                  </EuiFlexItem>
                </EuiFlexGroup>
                <EuiSpacer size="xs" />
              </>
            );
          })}
        </>
      ) : null}
      {filteredSuggestedDashboards.length ? (
        <>
          <EuiTitle size="xxs">
            <h5>{'Dashboards'}</h5>
          </EuiTitle>
          {filteredSuggestedDashboards.map((dashboard) => {
            return (
              <>
                <EuiFlexGroup alignItems="baseline">
                  <EuiFlexItem>
                    <div key={dashboard.id}>{dashboard.title}</div>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiButton
                      onClick={() =>
                        cases.addDashboardToCase({ id: dashboard.id, title: dashboard.title })
                      }
                    >
                      {'Add dashboard'}
                    </EuiButton>
                  </EuiFlexItem>
                </EuiFlexGroup>
                <EuiSpacer size="xs" />
              </>
            );
          })}
        </>
      ) : null}
      {suggestedDiscoverSessions.length ? (
        <>
          <EuiTitle size="xxs">
            <h5>{'Discover Sessions'}</h5>
          </EuiTitle>
          {suggestedDiscoverSessions.map((session) => {
            return (
              <>
                <EuiFlexGroup alignItems="baseline">
                  <EuiFlexItem>
                    <div key={session.id}>{session.title}</div>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiButton>{'Add session'}</EuiButton>
                  </EuiFlexItem>
                </EuiFlexGroup>
                <EuiSpacer size="xs" />
              </>
            );
          })}
        </>
      ) : null}
    </div>
  );
};

SuggestedAttachments.displayName = 'AttachmentsProps';
