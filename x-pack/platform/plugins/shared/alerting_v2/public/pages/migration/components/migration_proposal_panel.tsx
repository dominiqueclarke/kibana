/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import {
  EuiPanel,
  EuiFlexGroup,
  EuiFlexItem,
  EuiText,
  EuiSpacer,
  EuiCodeBlock,
  EuiAccordion,
  EuiMarkdownFormat,
  EuiIcon,
  useEuiTheme,
  EuiLoadingSpinner,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';

interface MigrationProposalPanelProps {
  proposal: Record<string, unknown>;
  notes: string;
  v1Rule?: Record<string, unknown>;
  isLoading?: boolean;
  isRefinement?: boolean;
}

export const MigrationProposalPanel: React.FC<MigrationProposalPanelProps> = ({
  proposal,
  notes,
  v1Rule,
  isLoading = false,
  isRefinement = false,
}) => {
  const { euiTheme } = useEuiTheme();

  return (
    <EuiPanel hasBorder paddingSize="m" hasShadow={false}>
      <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiIcon type="sparkles" color={euiTheme.colors.primary} />
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiText size="s">
            <strong>
              {isRefinement
                ? i18n.translate('xpack.alertingV2.migration.revisedProposal', {
                    defaultMessage: 'Revised proposal',
                  })
                : i18n.translate('xpack.alertingV2.migration.initialProposal', {
                    defaultMessage: 'Migration proposal',
                  })}
            </strong>
          </EuiText>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="m" />

      {isLoading ? (
        <EuiFlexGroup justifyContent="center" alignItems="center">
          <EuiFlexItem grow={false}>
            <EuiLoadingSpinner size="l" />
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiText size="s" color="subdued">
              {i18n.translate('xpack.alertingV2.migration.generating', {
                defaultMessage: 'Generating proposal...',
              })}
            </EuiText>
          </EuiFlexItem>
        </EuiFlexGroup>
      ) : (
        <>
          <EuiText size="s">
            <strong>
              {i18n.translate('xpack.alertingV2.migration.v2RuleLabel', {
                defaultMessage: 'V2 Rule',
              })}
            </strong>
          </EuiText>
          <EuiSpacer size="xs" />
          <EuiCodeBlock language="json" fontSize="s" paddingSize="m" isCopyable>
            {JSON.stringify(proposal, null, 2)}
          </EuiCodeBlock>

          <EuiSpacer size="m" />

          <EuiText size="s">
            <strong>
              {isRefinement
                ? i18n.translate('xpack.alertingV2.migration.changeNotesLabel', {
                    defaultMessage: 'What changed',
                  })
                : i18n.translate('xpack.alertingV2.migration.notesLabel', {
                    defaultMessage: 'Migration notes',
                  })}
            </strong>
          </EuiText>
          <EuiSpacer size="xs" />
          <EuiMarkdownFormat textSize="s">{notes}</EuiMarkdownFormat>

          {v1Rule && (
            <>
              <EuiSpacer size="m" />
              <EuiAccordion
                id="v1-rule-reference"
                buttonContent={i18n.translate('xpack.alertingV2.migration.v1RuleReference', {
                  defaultMessage: 'Original V1 rule (reference)',
                })}
              >
                <EuiSpacer size="s" />
                <EuiCodeBlock language="json" fontSize="s" paddingSize="m" isCopyable>
                  {JSON.stringify(v1Rule, null, 2)}
                </EuiCodeBlock>
              </EuiAccordion>
            </>
          )}
        </>
      )}
    </EuiPanel>
  );
};
