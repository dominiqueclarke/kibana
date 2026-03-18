/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { useEffect, useState } from 'react';
import type { HttpStart } from '@kbn/core/public';
import { useDiscoverServices } from '../../../../../hooks/use_discover_services';

// ============================================================================
// Constants
// ============================================================================

const ALERTING_V2_RULE_API_PATH = '/internal/alerting/v2/rule';

// ============================================================================
// Types
// ============================================================================

/**
 * Cached rule information to avoid repeated fetches
 */
export interface CachedRuleInfo {
  name: string;
  groupingKey: string[];
}

interface RuleResponse {
  id: string;
  name: string;
  groupingKey?: string[];
}

// ============================================================================
// Rule Info Cache
// ============================================================================

/**
 * Promise-based cache for rule info.
 * Stores pending promises to deduplicate concurrent requests for the same rule ID.
 */
const ruleInfoCache = new Map<string, Promise<CachedRuleInfo | null>>();

/**
 * Fetches rule info, using a promise-based cache to deduplicate concurrent requests.
 * If a request for the same rule ID is already in flight, returns the existing promise.
 */
function fetchRuleInfo(http: HttpStart, ruleId: string): Promise<CachedRuleInfo | null> {
  const existing = ruleInfoCache.get(ruleId);
  if (existing) return existing;

  const promise = http
    .get<RuleResponse>(`${ALERTING_V2_RULE_API_PATH}/${ruleId}`)
    .then((response) => ({
      name: response.name,
      groupingKey: response.groupingKey ?? [],
    }))
    .catch(() => null);

  ruleInfoCache.set(ruleId, promise);
  return promise;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to fetch and cache rule information.
 * Uses promise-based caching to deduplicate concurrent requests for the same rule ID.
 *
 * @param ruleId - The ID of the rule to fetch
 * @returns Object containing ruleInfo (name and groupingKey) and loading state
 */
export function useRuleInfo(ruleId: string | undefined) {
  const { http } = useDiscoverServices();
  const [ruleInfo, setRuleInfo] = useState<CachedRuleInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!ruleId) return;

    setIsLoading(true);
    fetchRuleInfo(http, ruleId)
      .then(setRuleInfo)
      .finally(() => setIsLoading(false));
  }, [ruleId, http]);

  return { ruleInfo, isLoading };
}
