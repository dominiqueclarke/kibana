/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { EuiTitle, EuiSpacer } from '@elastic/eui';
import { useApplicationCapabilities, useKibana } from '../../common/lib/kibana';
// import { AllCasesList } from './all_cases';
// import { CasesFetch } from './cases_fetch';
import { CasesTable } from './cases_table';
import { DockedCase } from './docked_case';

interface WorkbenchProps {
  getCasesContext: () => React.ElementType;
}

const Component = ({ getCasesContext }: WorkbenchProps) => {
  const {
    services: {
      chrome: { workspace },
    },
  } = useKibana();
  const dockedCaseIdState = useSelector((state) => state.cases.dockedCaseId);
  const [dockedCaseId, setdockedCaseId] = useState<string | null>(dockedCaseIdState || null);

  const handleSetActiveCase = useCallback(
    (id: string) => {
      setdockedCaseId(id);
      workspace.cases.setActiveCase(id);
    },
    [workspace]
  );

  const CasesContext: React.ElementType = getCasesContext();
  const userCapabilities = useApplicationCapabilities();
  return (
    <CasesContext permissions={userCapabilities.generalCasesV3} owner={['observability']}>
      {dockedCaseId && <DockedCase dockedCaseId={dockedCaseId} />}
      {!dockedCaseId && <CasesTable onSetActiveCase={handleSetActiveCase} />}
    </CasesContext>
  );
};

Component.displayName = 'WorkbenchComponent';

export const Workbench: React.FC<WorkbenchProps> = ({ getCasesContext }) => {
  const {
    services: {
      chrome: { workspace },
    },
  } = useKibana();
  const WorkspaceProvider = workspace.getStateProvider();

  return (
    <WorkspaceProvider>
      <Component getCasesContext={getCasesContext} />
    </WorkspaceProvider>
  );
};

Workbench.displayName = 'Workbench';
