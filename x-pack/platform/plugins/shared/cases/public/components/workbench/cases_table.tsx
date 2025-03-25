/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useEffect, useState } from 'react';
import {
  formatDate,
  EuiTitle,
  EuiBasicTable,
  type EuiBasicTableColumn,
  type EuiTableFieldDataColumnType,
  EuiLink,
  EuiHealth,
  EuiBadge,
  EuiSpacer,
  EuiButtonEmpty,
} from '@elastic/eui';
import { faker } from '@faker-js/faker';
import { getCases } from '../../containers/api';
import type { CasesUI, CaseUI } from '../../../common/ui/types';

interface CasesTableProps {
  onSetActiveCase: (caseId: string) => void;
}

export function CasesTable({ onSetActiveCase }: CasesTableProps) {
  const [cases, setCases] = useState<CasesUI>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await getCases({
          filterOptions: {
            search: '',
            searchFields: [],
            severity: [],
            assignees: [],
            reporters: [],
            status: [],
            tags: [],
            owner: ['observability'],
            category: [],
            customFields: {},
          },
        });
        setCases(response.cases);
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);
  const columns: Array<EuiBasicTableColumn<CaseUI>> = [
    {
      field: 'title',
      name: 'Name',
      'data-test-subj': 'nameCell',
      mobileOptions: {
        header: true,
        truncateText: true,
        enlarge: true,
        width: '100%',
      },
    },
    {
      field: 'severity',
      name: 'Severity',
      'data-test-subj': 'statusCell',
      render: (severity: string) => {
        const color = severity === 'low' ? 'subdued' : 'danger';
        return (
          <EuiHealth color={color}>
            {severity.charAt(0).toUpperCase() + severity.slice(1)}
          </EuiHealth>
        );
      },
      width: '85px',
    },
    {
      name: 'Actions',
      render: (caseItem: CaseUI) => {
        return (
          <EuiButtonEmpty onClick={() => onSetActiveCase(caseItem.id)}>
            {'Set as docked case'}
          </EuiButtonEmpty>
        );
      },
      width: '180px',
    },
  ];

  const getRowProps = (user: User) => {
    const { id } = user;
    return {
      'data-test-subj': `row-${id}`,
      className: 'customRowClass',
      onClick: () => {},
    };
  };

  return cases.length ? (
    <>
      <EuiTitle>
        <h2>{'Open cases'}</h2>
      </EuiTitle>
      <EuiSpacer size="s" />
      <EuiBasicTable
        tableCaption="Demo of EuiBasicTable"
        items={cases}
        rowHeader="firstName"
        columns={columns}
        rowProps={getRowProps}
      />
    </>
  ) : null;
}

CasesTable.displayName = 'CasesTable';
