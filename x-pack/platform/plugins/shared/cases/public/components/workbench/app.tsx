/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import { Router } from '@kbn/shared-ux-router';

import { KibanaContextProvider } from '@kbn/kibana-react-plugin/public';

import type { ScopedFilesClient } from '@kbn/files-plugin/public';
import { KibanaRenderContextProvider } from '@kbn/react-kibana-context-render';
import type { ExternalReferenceAttachmentTypeRegistry } from '../../client/attachment_framework/external_reference_registry';
import type { PersistableStateAttachmentTypeRegistry } from '../../client/attachment_framework/persistable_state_registry';
import { Workbench } from './workbench';
import type { RenderAppProps } from '../types';
import { useKibana } from '../../common/lib/kibana';

export const App: React.FC<{
  kibanaVersion: RenderAppProps['kibanaVersion'];
  coreStart: RenderAppProps['coreStart'];
  pluginsStart: RenderAppProps['pluginsStart'];
  storage: RenderAppProps['storage'];
  getCasesContext: () => React.ReactNode;
}> = ({ kibanaVersion, coreStart, pluginsStart, storage, getCasesContext }) => {
  return (
    <KibanaRenderContextProvider {...coreStart}>
      <KibanaContextProvider
        services={{
          kibanaVersion,
          ...coreStart,
          ...pluginsStart,
          storage,
        }}
      >
        <Workbench getCasesContext={getCasesContext} />
      </KibanaContextProvider>
    </KibanaRenderContextProvider>
  );
};

App.displayName = 'App';
