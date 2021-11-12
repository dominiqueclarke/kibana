/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { CoreSetup } from 'kibana/server';
import { pushConfigs } from './push_configs';

export async function syncSyntheticsConfig({ core }: { core: CoreSetup }) {
  /* This should be a separate process. We need to have a UI toggle to turn on an off the ability
   * to use the service (since there is billing involved). Generating the api key should happen on this action */
  // const apiKey: SyntheticsServiceApiKey = await axios.get(API_URLS.API_KEYS);
  // if (apiKey) {
  //   await axios.post(API_URLS.SYNC_CONFIG);
  // }
  // await pushConfigs({ core });
}
