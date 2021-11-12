/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { UMRestApiRouteFactory } from '../types';
import { savedObjectsAdapter } from '../../lib/saved_objects';
import { API_URLS } from '../../../common/constants';
import { SecurityPluginStart } from '../../../../security/server';

export const createGetAPIKeysRoute: UMRestApiRouteFactory = () => ({
  method: 'GET',
  path: API_URLS.API_KEYS,
  validate: {},
  handler: async ({ plugins, request, savedObjectsClient }): Promise<any> => {
    await generateAPIKey({ security: plugins.security });
  },
});

export const generateAPIKey = async ({ security }: { security: SecurityPluginStart }) => {
  try {
    const isApiKeysEnabled = await security.authc.apiKeys?.areAPIKeysEnabled();

    if (isApiKeysEnabled) {
      return null;
    }

    const apiKey = await security.authc.apiKeys?.create(request, {
      name: 'test-api-key',
      role_descriptors: {},
    });

    if (apiKey) {
      await savedObjectsAdapter.setSyntheticsServiceApiKey(savedObjectsClient, apiKey);
    }
    return apiKey;
  } catch (e) {
    throw e;
  }
};
