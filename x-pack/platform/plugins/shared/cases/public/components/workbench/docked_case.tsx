/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState } from 'react';
import { EuiTitle, EuiSpacer, EuiButtonGroup } from '@elastic/eui';
import { useGetCase } from '../../containers/use_get_case';
import { useFetchAlertData } from './hooks/use_fetch_alert_data';
import { CaseActivity } from './case_activity';
import { Attachments } from './attachments';
import { InvestigationGuide } from './investigation_guide';

interface ActiveCaseProps {
  dockedCaseId: string;
}

export function DockedCase({ dockedCaseId }: ActiveCaseProps) {
  const { data, isLoading, isError, refetch } = useGetCase(dockedCaseId);
  const { case: caseData } = data || {};

  const toggleButtons = [
    {
      id: `activeCaseAttachments`,
      label: 'Attachments',
    },
    {
      id: `activeCaseGuide`,
      label: 'Investigation guide',
    },
    {
      id: `activeCaseActivity`,
      label: 'Activity',
    },
  ];

  const [toggleIdSelected, setToggleIdSelected] = useState('activeCaseAttachments');

  const onChange = (optionId: string) => {
    setToggleIdSelected(optionId);
  };

  if (isLoading) {
    return <div>{'Loading active case'}</div>;
  }

  if (!caseData) {
    return <div>{'No active case found'}</div>;
  }

  if (isError) {
    return <div>{'Error loading active case'}</div>;
  }

  return (
    <div>
      <EuiTitle>
        <h2>{caseData.title}</h2>
      </EuiTitle>
      <EuiSpacer />
      <EuiButtonGroup
        legend="This is a basic group"
        options={toggleButtons}
        idSelected={toggleIdSelected}
        onChange={(id) => onChange(id)}
      />
      <EuiSpacer />
      {toggleIdSelected === 'activeCaseAttachments' && <Attachments caseData={caseData} />}
      {toggleIdSelected === 'activeCaseActivity' && (
        <CaseActivity caseData={caseData} useFetchAlertData={useFetchAlertData} />
      )}
      {toggleIdSelected === 'activeCaseGuide' && <InvestigationGuide />}
    </div>
  );
}

DockedCase.displayName = 'DockedCase';
