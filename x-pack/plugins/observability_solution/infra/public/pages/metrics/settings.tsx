/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiErrorBoundary } from '@elastic/eui';
import React from 'react';
import { useKibana } from '@kbn/kibana-react-plugin/public';
import { SourceConfigurationSettings } from './settings/source_configuration_settings';

export const MetricsSettingsPage = () => {
  const { application, http } = useKibana().services;
  return (
    <EuiErrorBoundary>
      <SourceConfigurationSettings
        shouldAllowEdit={
          (application?.capabilities?.infrastructure?.configureSource as boolean) ||
          (application?.capabilities?.observability?.['infra:configureSource'] as boolean)
        }
        http={http}
      />
    </EuiErrorBoundary>
  );
};
