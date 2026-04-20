/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { Route, Routes } from '@kbn/shared-ux-router';
import { MigrationLandingPage } from '../pages/migration/migration_landing_page';
import { MigrationSessionPage } from '../pages/migration/migration_session_page';

export const MigrationApp = () => {
  return (
    <Routes>
      <Route path="/session/:sessionId">
        <MigrationSessionPage />
      </Route>
      <Route exact path="/">
        <MigrationLandingPage />
      </Route>
    </Routes>
  );
};
