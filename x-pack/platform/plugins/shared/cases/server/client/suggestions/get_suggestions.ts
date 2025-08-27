/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import type { Observable } from 'rxjs';

import type { CasesClientArgs } from '../types';
import { runCaseSuggestions } from './run_suggestions/run_get_case_suggestions';
import type { SuggestionEvent } from '../../../common/types/api';

import type { FetchSuggestionsForOwnersArgs } from './types';

/**
 * Retrieves all the suggestions for the specified owners.
 */
export function fetchSuggestionsForOwners(
  { owners, context, request, connectorId }: FetchSuggestionsForOwnersArgs,
  clientArgs: CasesClientArgs
): Observable<SuggestionEvent> {
  const { attachmentSuggestionRegistry, logger, inferenceClient } = clientArgs;

  const suggestionEvents = runCaseSuggestions({
    connectorId,
    context,
    inferenceClient,
    logger,
    owners,
    prevEvents: [],
    request,
    suggestionRegistry: attachmentSuggestionRegistry,
  });

  return suggestionEvents;
}
