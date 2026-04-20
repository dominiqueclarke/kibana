/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState, useCallback } from 'react';
import {
  EuiPageHeader,
  EuiSpacer,
  EuiBasicTable,
  EuiBadge,
  EuiButton,
  EuiEmptyPrompt,
  EuiLoadingSpinner,
  type EuiBasicTableColumn,
} from '@elastic/eui';
import { useQuery, useMutation } from '@kbn/react-query';
import { useHistory } from 'react-router-dom';
import { i18n } from '@kbn/i18n';
import { CoreStart, useService } from '@kbn/core-di-browser';

interface V1Rule {
  id: string;
  name: string;
  rule_type_id: string;
  enabled: boolean;
  tags: string[];
  params: {
    searchType?: string;
    esqlQuery?: { esql: string };
    groupBy?: string;
  };
}

type Eligibility = 'ready' | 'not_supported';

const getEligibility = (rule: V1Rule): Eligibility => {
  if (rule.rule_type_id === '.es-query' && rule.params.searchType === 'esqlQuery') {
    return 'ready';
  }
  return 'not_supported';
};

const getRuleTypeSummary = (rule: V1Rule): string => {
  if (rule.rule_type_id === '.es-query') {
    return `ES Query (${rule.params.searchType ?? 'unknown'})`;
  }
  return rule.rule_type_id;
};

export const MigrationLandingPage: React.FC = () => {
  const http = useService(CoreStart('http'));
  const history = useHistory();
  const [migratingRuleId, setMigratingRuleId] = useState<string | null>(null);

  const {
    data: rules,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['v1-rules-for-migration'],
    queryFn: async () => {
      const response = await http.get<{ data: V1Rule[]; total: number }>(
        '/api/alerting/rules/_find',
        { query: { per_page: 100 } }
      );
      return response.data;
    },
  });

  const migrateMutation = useMutation({
    mutationFn: async (v1RuleId: string) => {
      const response = await http.post<{ sessionId: string }>(
        '/internal/alerting_v2/migrate',
        { body: JSON.stringify({ v1RuleId }) }
      );
      return response;
    },
    onSuccess: (data) => {
      history.push(`/session/${data.sessionId}`);
    },
  });

  const handleMigrate = useCallback(
    (ruleId: string) => {
      setMigratingRuleId(ruleId);
      migrateMutation.mutate(ruleId);
    },
    [migrateMutation]
  );

  const columns: Array<EuiBasicTableColumn<V1Rule>> = [
    {
      field: 'name',
      name: i18n.translate('xpack.alertingV2.migration.columns.name', {
        defaultMessage: 'Name',
      }),
      truncateText: true,
    },
    {
      field: 'rule_type_id',
      name: i18n.translate('xpack.alertingV2.migration.columns.type', {
        defaultMessage: 'Type',
      }),
      render: (_: string, rule: V1Rule) => getRuleTypeSummary(rule),
      width: '200px',
    },
    {
      field: 'enabled',
      name: i18n.translate('xpack.alertingV2.migration.columns.status', {
        defaultMessage: 'Status',
      }),
      render: (enabled: boolean) => (
        <EuiBadge color={enabled ? 'success' : 'default'}>
          {enabled ? 'Enabled' : 'Disabled'}
        </EuiBadge>
      ),
      width: '100px',
    },
    {
      name: i18n.translate('xpack.alertingV2.migration.columns.eligibility', {
        defaultMessage: 'Eligibility',
      }),
      render: (rule: V1Rule) => {
        const eligibility = getEligibility(rule);
        return eligibility === 'ready' ? (
          <EuiBadge color="success">Ready</EuiBadge>
        ) : (
          <EuiBadge color="hollow">Not yet supported</EuiBadge>
        );
      },
      width: '160px',
    },
    {
      name: i18n.translate('xpack.alertingV2.migration.columns.actions', {
        defaultMessage: 'Actions',
      }),
      render: (rule: V1Rule) => {
        const eligibility = getEligibility(rule);
        const isCurrentlyMigrating = migratingRuleId === rule.id && migrateMutation.isLoading;
        return (
          <EuiButton
            size="s"
            isDisabled={eligibility !== 'ready' || migrateMutation.isLoading}
            isLoading={isCurrentlyMigrating}
            onClick={() => handleMigrate(rule.id)}
          >
            {i18n.translate('xpack.alertingV2.migration.migrateButton', {
              defaultMessage: 'Migrate',
            })}
          </EuiButton>
        );
      },
      width: '120px',
    },
  ];

  if (isLoading) {
    return <EuiLoadingSpinner size="xl" />;
  }

  if (error) {
    return (
      <EuiEmptyPrompt
        iconType="warning"
        title={
          <h2>
            {i18n.translate('xpack.alertingV2.migration.errorTitle', {
              defaultMessage: 'Unable to load rules',
            })}
          </h2>
        }
        body={<p>{String(error)}</p>}
      />
    );
  }

  return (
    <>
      <EuiPageHeader
        pageTitle={i18n.translate('xpack.alertingV2.migration.pageTitle', {
          defaultMessage: 'Rule Migration',
        })}
        description={i18n.translate('xpack.alertingV2.migration.pageDescription', {
          defaultMessage:
            'Migrate V1 alerting rules to V2. Select a rule to generate a migration proposal.',
        })}
      />
      <EuiSpacer size="l" />
      <EuiBasicTable
        items={rules ?? []}
        columns={columns}
        rowHeader="name"
        noItemsMessage={i18n.translate('xpack.alertingV2.migration.noRules', {
          defaultMessage: 'No V1 rules found. Create some rules to migrate.',
        })}
      />
    </>
  );
};
