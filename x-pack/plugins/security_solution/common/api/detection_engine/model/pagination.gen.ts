/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from 'zod';

/*
 * NOTICE: Do not edit this file manually.
 * This file is automatically generated by the OpenAPI Generator, @kbn/openapi-generator.
 *
 * info:
 *   title: Pagination Schema
 *   version: not applicable
 */

/**
 * Page number
 */
export type Page = z.infer<typeof Page>;
export const Page = z.number().int().min(1);

/**
 * Number of items per page
 */
export type PerPage = z.infer<typeof PerPage>;
export const PerPage = z.number().int().min(0);

export type PaginationResult = z.infer<typeof PaginationResult>;
export const PaginationResult = z.object({
  page: Page,
  per_page: PerPage,
  /**
   * Total number of items
   */
  total: z.number().int().min(0),
});
