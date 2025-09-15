/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { i18n } from '@kbn/i18n';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiLoadingSpinner,
  EuiPanel,
  EuiAccordion,
  EuiSpacer,
  EuiText,
} from '@elastic/eui';
import { AssistantIcon } from '@kbn/ai-assistant-icon';
import type { CaseUI } from '../../../../common';
import { CaseSuggestionItem } from './case_suggestion_item';
import { useCaseSuggestions } from '../use_case_suggestions';

export const CaseSuggestions = ({ caseData }: { caseData: CaseUI }) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const { visibleSuggestions, setDismissedIds, componentById, fetchSuggestions } =
    useCaseSuggestions({
      caseData,
    });

  const onToggle = async (isOpen: boolean) => {
    if (isOpen && visibleSuggestions.length === 0) {
      setIsLoading(true);
      await fetchSuggestions();
      setIsLoading(false);
    }
  };

  return (
    <EuiPanel hasBorder hasShadow={false}>
      <EuiAccordion
        id="aiSummaryContainer"
        arrowProps={{ css: { alignSelf: 'flex-start' } }}
        buttonContent={
          <EuiFlexGroup wrap responsive={false} gutterSize="m" data-test-subj="aiSummaryButton">
            <EuiFlexItem grow={false}>
              <EuiSpacer size="xs" />
              <AssistantIcon size="m" />
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiFlexGroup gutterSize="s" alignItems="center">
                <EuiText>
                  <h5>
                    {i18n.translate('xpack.suggestions.title', {
                      defaultMessage: 'AI-Generated Suggestions',
                    })}
                  </h5>
                </EuiText>
              </EuiFlexGroup>
            </EuiFlexItem>
          </EuiFlexGroup>
        }
        isLoading={isLoading}
        isDisabled={isLoading}
        onToggle={onToggle}
      >
        {visibleSuggestions.length === 0 && !isLoading ? (
          <EuiText
            size="s"
            color="subdued"
            data-test-subj="noSuggestionsText"
            css={{ marginTop: '8px', marginBottom: '8px' }}
          >
            {i18n.translate('xpack.suggestions.noSuggestions', {
              defaultMessage: 'No suggestions available',
            })}
          </EuiText>
        ) : isLoading ? (
          <EuiFlexGroup justifyContent="center" alignItems="center" style={{ minHeight: 100 }}>
            <EuiLoadingSpinner size="m" />
          </EuiFlexGroup>
        ) : (
          <EuiFlexGroup gutterSize="m" wrap direction="column">
            {visibleSuggestions.map((suggestion) => {
              return (
                <CaseSuggestionItem
                  key={suggestion.id}
                  suggestion={suggestion}
                  caseData={caseData}
                  setDismissedIds={setDismissedIds}
                  componentById={componentById}
                />
              );
            })}
          </EuiFlexGroup>
        )}
      </EuiAccordion>
    </EuiPanel>
  );
};

CaseSuggestions.displayName = 'CaseSuggestions';
