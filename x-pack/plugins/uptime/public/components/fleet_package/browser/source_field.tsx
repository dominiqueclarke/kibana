/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React, { useEffect, useState } from 'react';
import { FormattedMessage } from '@kbn/i18n/react';
import { i18n } from '@kbn/i18n';

import { EuiTabbedContent, EuiFormRow, EuiFieldText, EuiSpacer } from '@elastic/eui';
import { OptionalLabel } from '../optional_label';
import { CodeEditor } from '../code_editor';
import { MonacoEditorLangId } from '../types';

enum SourceType {
  INLINE = 'syntheticsBrowserInlineConfig',
  ZIP = 'syntheticsBrowserZipURLConfig',
}

interface SourceConfig {
  zipUrl: string;
  folder: string;
  username: string;
  password: string;
  inlineScript: string;
}

interface Props {
  onChange: (sourceConfig: SourceConfig) => void;
  defaultConfig: SourceConfig;
}

const defaultValues = {
  zipUrl: '',
  folder: '',
  username: '',
  password: '',
  inlineScript: '',
};

export const SourceField = ({ onChange, defaultConfig = defaultValues }: Props) => {
  const [sourceType, setSourceType] = useState<SourceType>(
    defaultConfig.inlineScript ? SourceType.INLINE : SourceType.ZIP
  );
  const [config, setConfig] = useState<SourceConfig>(defaultConfig);

  useEffect(() => {
    onChange(config);
  }, [config, onChange]);

  const tabs = [
    {
      id: 'syntheticsBrowserZipURLConfig',
      name: (
        <FormattedMessage
          id="xpack.uptime.createPackagePolicy.stepConfigure.monitorIntegrationSettingsSection.browser.zipUrl.label"
          defaultMessage="Zip URL"
        />
      ),
      content: (
        <>
          <EuiSpacer size="m" />
          <EuiFormRow
            label={
              <FormattedMessage
                id="xpack.uptime.createPackagePolicy.stepConfigure.monitorIntegrationSettingsSection.browser.zipUrl.label"
                defaultMessage="Zip URL"
              />
            }
            isInvalid={!config.zipUrl}
            error={
              <FormattedMessage
                id="xpack.uptime.createPackagePolicy.stepConfigure.monitorIntegrationSettingsSection.browser.zipUrl.error"
                defaultMessage="Zip URL is required"
              />
            }
          >
            <EuiFieldText
              onChange={({ target: { value } }) =>
                setConfig((prevConfig) => ({ ...prevConfig, zipUrl: value }))
              }
              value={config.zipUrl}
            />
          </EuiFormRow>
          <EuiFormRow
            label={
              <FormattedMessage
                id="xpack.uptime.createPackagePolicy.stepConfigure.monitorIntegrationSettingsSection.browser.zipUrlUsername"
                defaultMessage="Zip URL Username"
              />
            }
            labelAppend={<OptionalLabel />}
          >
            <EuiFieldText
              onChange={({ target: { value } }) =>
                setConfig((prevConfig) => ({ ...prevConfig, username: value }))
              }
              value={config.username}
            />
          </EuiFormRow>
          <EuiFormRow
            label={
              <FormattedMessage
                id="xpack.uptime.createPackagePolicy.stepConfigure.monitorIntegrationSettingsSection.browser.zipUrlFolder"
                defaultMessage="Folder"
              />
            }
            labelAppend={<OptionalLabel />}
          >
            <EuiFieldText
              onChange={({ target: { value } }) =>
                setConfig((prevConfig) => ({ ...prevConfig, folder: value }))
              }
              value={config.folder}
            />
          </EuiFormRow>
          <EuiFormRow
            label={
              <FormattedMessage
                id="xpack.uptime.createPackagePolicy.stepConfigure.monitorIntegrationSettingsSection.browser.zipUrlPassword"
                defaultMessage="Zip URL Password"
              />
            }
            labelAppend={<OptionalLabel />}
          >
            <EuiFieldText
              onChange={({ target: { value } }) =>
                setConfig((prevConfig) => ({ ...prevConfig, password: value }))
              }
              value={config.password}
            />
          </EuiFormRow>
        </>
      ),
    },
    {
      id: 'syntheticsBrowserInlineConfig',
      name: (
        <FormattedMessage
          id="xpack.uptime.createPackagePolicy.stepConfigure.monitorIntegrationSettingsSection.browser.inlineScript.label"
          defaultMessage="Inline script"
        />
      ),
      content: (
        <EuiFormRow
          isInvalid={!!config.inlineScript}
          error={
            <FormattedMessage
              id="xpack.uptime.createPackagePolicy.stepConfigure.monitorIntegrationSettingsSection.browser.inlineScript.error"
              defaultMessage="Script is required"
            />
          }
        >
          <CodeEditor
            ariaLabel={i18n.translate(
              'xpack.uptime.createPackagePolicy.stepConfigure.requestBody.codeEditor.javascript.ariaLabel',
              {
                defaultMessage: 'JavaScript code editor',
              }
            )}
            id="javascript"
            languageId={MonacoEditorLangId.JAVASCRIPT}
            onChange={(code) => setConfig((prevConfig) => ({ ...prevConfig, inlineScript: code }))}
            value={config.inlineScript}
          />
        </EuiFormRow>
      ),
    },
  ];

  return (
    <EuiTabbedContent
      tabs={tabs}
      initialSelectedTab={tabs.find((tab) => tab.id === sourceType)}
      autoFocus="selected"
      onTabClick={(tab) => {
        setSourceType(tab.id as SourceType);
        if (tab.id !== sourceType) {
          setConfig(defaultValues);
        }
      }}
    />
  );
};
