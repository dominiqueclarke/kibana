/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState, useCallback } from 'react';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiTextArea,
  EuiButtonIcon,
  useEuiTheme,
  keys,
} from '@elastic/eui';
import { css } from '@emotion/react';
import { i18n } from '@kbn/i18n';

interface MigrationInputProps {
  onSubmit: (feedback: string) => void;
  isDisabled: boolean;
  isLoading: boolean;
}

export const MigrationInput: React.FC<MigrationInputProps> = ({
  onSubmit,
  isDisabled,
  isLoading,
}) => {
  const { euiTheme } = useEuiTheme();
  const [value, setValue] = useState('');

  const containerStyles = css`
    border: ${euiTheme.border.thin};
    border-radius: 16px;
    border-color: ${euiTheme.colors.borderBaseSubdued};
    padding: ${euiTheme.size.s};
    &:focus-within {
      border-color: ${euiTheme.colors.primary};
    }
  `;

  const textAreaStyles = css`
    .euiTextArea {
      border: none;
      box-shadow: none;
      background: transparent;
      resize: none;
      max-height: 240px;
      &:focus {
        box-shadow: none;
        background: transparent;
      }
    }
  `;

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isDisabled) return;
    onSubmit(trimmed);
    setValue('');
  }, [value, isDisabled, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!e.shiftKey && e.key === keys.ENTER) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <EuiFlexGroup css={containerStyles} alignItems="flexEnd" gutterSize="s" responsive={false}>
      <EuiFlexItem css={textAreaStyles}>
        <EuiTextArea
          fullWidth
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={i18n.translate('xpack.alertingV2.migration.inputPlaceholder', {
            defaultMessage: 'Describe what to change...',
          })}
          disabled={isDisabled}
          data-test-subj="migrationFeedbackInput"
        />
      </EuiFlexItem>
      <EuiFlexItem grow={false}>
        {isLoading ? (
          <EuiButtonIcon
            aria-label={i18n.translate('xpack.alertingV2.migration.stopButton', {
              defaultMessage: 'Stop',
            })}
            iconType="stopFill"
            size="s"
            color="text"
            display="base"
            data-test-subj="migrationStopButton"
          />
        ) : (
          <EuiButtonIcon
            aria-label={i18n.translate('xpack.alertingV2.migration.submitFeedback', {
              defaultMessage: 'Submit feedback',
            })}
            iconType="sortUp"
            display="fill"
            size="s"
            disabled={!value.trim() || isDisabled}
            onClick={handleSubmit}
            data-test-subj="migrationSubmitFeedbackButton"
          />
        )}
      </EuiFlexItem>
    </EuiFlexGroup>
  );
};
