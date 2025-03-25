/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { type PayloadAction, createSlice } from '@reduxjs/toolkit';

export interface Dashboard {
  id: string;
  title: string;
  isFocused?: boolean;
}

export interface DisocverSession {
  id: string;
  title: string;
}

export interface CasesState {
  dockedCaseId?: string;
  dashboards: Dashboard[];
  suggestedDashboards: Dashboard[];
  discoverSessions: DisocverSession[];
  suggestedDiscoverSessions: DisocverSession[];
  suggestedAlerts: Array<{ isFocused?: boolean; id: string; name: string }>;
}

export const initialState: CasesState = {
  dockedCaseId: undefined,
  dashboards: [
    { id: '48089ec0-f039-11ed-bdc6-f382ac874aa0', title: 'Message Processor Operation' },
  ],
  discoverSessions: [],
  suggestedAlerts: [],
  suggestedDashboards: [],
  suggestedDiscoverSessions: [],
};

export const casesSlice = createSlice({
  name: 'workspace/cases',
  initialState,
  reducers: {
    setActiveCase: (state, action: PayloadAction<string>) => {
      state.dockedCaseId = action.payload;
    },
    setSuggestedAlerts: (
      state,
      action: PayloadAction<Array<{ isFocused?: boolean; id: string; name: string }>>
    ) => {
      state.suggestedAlerts = action.payload;
    },
    setSuggestedDashboards: (
      state,
      action: PayloadAction<Array<{ id: string; title: string }>>
    ) => {
      state.suggestedDashboards = action.payload;
    },
    addDashboardToCase: (state, action: PayloadAction<Dashboard>) => {
      state.dashboards.push(action.payload);
    },
    setSuggestedDiscoverSessions: (
      state,
      action: PayloadAction<Array<{ id: string; title: string }>>
    ) => {
      state.suggestedDiscoverSessions = action.payload;
    },
  },
});

export const {
  setActiveCase,
  setSuggestedAlerts,
  setSuggestedDashboards,
  addDashboardToCase,
  setSuggestedDiscoverSessions,
} = casesSlice.actions;
export const casesReducer = casesSlice.reducer;
