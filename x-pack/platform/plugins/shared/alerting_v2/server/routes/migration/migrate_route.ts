/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { KibanaRequest, RouteSecurity } from '@kbn/core-http-server';
import { inject, injectable } from 'inversify';
import { Request } from '@kbn/core-di-server';
import { buildRouteValidationWithZod } from '@kbn/zod-helpers/v4';
import { z } from '@kbn/zod/v4';
import { ALERTING_V2_API_PRIVILEGES } from '../../lib/security/privileges';
import { BaseAlertingRoute } from '../base_alerting_route';
import { AlertingRouteContext } from '../alerting_route_context';
import type { MigrationService } from '../../lib/migration/migration_service';
import { MigrationServiceToken } from '../../lib/migration/tokens';

const migrateBodySchema = z.object({
  v1RuleId: z.string(),
});

@injectable()
export class MigrateRoute extends BaseAlertingRoute {
  static method = 'post' as const;
  static path = '/internal/alerting_v2/migrate';
  static security: RouteSecurity = {
    authz: {
      requiredPrivileges: [ALERTING_V2_API_PRIVILEGES.rules.write],
    },
  };
  static routeOptions = {
    access: 'internal' as const,
    summary: 'Start a V1 to V2 rule migration',
  };
  static validate = {
    request: {
      body: buildRouteValidationWithZod(migrateBodySchema),
    },
  };

  protected readonly routeName = 'migrate rule';

  constructor(
    @inject(AlertingRouteContext) ctx: AlertingRouteContext,
    @inject(Request)
    private readonly request: KibanaRequest<unknown, unknown, z.infer<typeof migrateBodySchema>>,
    @inject(MigrationServiceToken) private readonly migrationService: MigrationService
  ) {
    super(ctx);
  }

  protected async execute() {
    const { v1RuleId } = this.request.body;
    const result = await this.migrationService.startMigration(this.request, v1RuleId);
    return this.ctx.response.ok({ body: result });
  }
}
