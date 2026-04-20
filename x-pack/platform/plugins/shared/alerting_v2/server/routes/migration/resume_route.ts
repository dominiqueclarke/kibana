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

const resumeParamsSchema = z.object({
  sessionId: z.string(),
});

const resumeBodySchema = z.object({
  action: z.enum(['approve', 'refine', 'cancel']),
  feedback: z.string().optional(),
});

@injectable()
export class ResumeRoute extends BaseAlertingRoute {
  static method = 'post' as const;
  static path = '/internal/alerting_v2/migrate/{sessionId}/resume';
  static security: RouteSecurity = {
    authz: {
      requiredPrivileges: [ALERTING_V2_API_PRIVILEGES.rules.write],
    },
  };
  static routeOptions = {
    access: 'internal' as const,
    summary: 'Resume a migration session',
  };
  static validate = {
    request: {
      params: buildRouteValidationWithZod(resumeParamsSchema),
      body: buildRouteValidationWithZod(resumeBodySchema),
    },
  };

  protected readonly routeName = 'resume migration';

  constructor(
    @inject(AlertingRouteContext) ctx: AlertingRouteContext,
    @inject(Request)
    private readonly request: KibanaRequest<
      z.infer<typeof resumeParamsSchema>,
      unknown,
      z.infer<typeof resumeBodySchema>
    >,
    @inject(MigrationServiceToken) private readonly migrationService: MigrationService
  ) {
    super(ctx);
  }

  protected async execute() {
    const { sessionId } = this.request.params;
    const { action, feedback } = this.request.body;
    const result = await this.migrationService.resume(
      this.request,
      sessionId,
      action,
      feedback
    );
    return this.ctx.response.ok({ body: result });
  }
}
