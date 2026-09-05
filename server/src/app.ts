import compression from 'compression';
import {
  apiNotFoundMiddleware,
  HttpError,
  jsonErrorMiddleware,
  notFoundError,
} from '@mikaelcedergren/cx-framework/server/errors';
import { healthMiddleware } from '@mikaelcedergren/cx-framework/server/health';
import { createOriginGuard } from '@mikaelcedergren/cx-framework/server/origin';
import { requestIdMiddleware } from '@mikaelcedergren/cx-framework/server/request-id';
import {
  hardenApplication,
  noindexHeader,
  noStoreHeader,
  securityHeaders,
} from '@mikaelcedergren/cx-framework/server/security';
import {
  SERVER_IDENTITY_PATH,
  serverReleaseIdentityMiddleware,
  type ServerReleaseIdentity,
} from '@mikaelcedergren/cx-framework/server/server-identity';
import type { BrowserServing } from '@mikaelcedergren/cx-framework/server/static-files';
import express, { type NextFunction, type Request, type Response } from 'express';

import { type AuthenticatedOwnerSession, type OwnerAuthService } from './auth-service.js';
import { mountFaunapoolenBrowser } from './browser-serving.js';
import {
  ADMIN_API_PATH,
  ADMIN_REQUEST_BODY_LIMIT,
  CAMPAIGN_ID_PATTERN,
  FAUNAPOOLEN_PRODUCT_ID,
  PRIVATE_NOINDEX_PATHS,
} from './constants.js';
import { copyLength } from './copy-budgets.js';
import type { FaunapoolenEnvironment } from './environment.js';
import type {
  CampaignCopyUpdate,
  CampaignMutationResult,
  CampaignService,
  DatabaseReadiness,
  GenerationService,
  GenerationStage,
} from './http-contracts.js';

export interface FaunapoolenApplicationOptions {
  readonly authService: OwnerAuthService;
  readonly browserServing: BrowserServing;
  readonly campaignService: CampaignService;
  readonly databaseReadiness: DatabaseReadiness;
  readonly environment: FaunapoolenEnvironment;
  readonly generationService: GenerationService;
  readonly identity?: ServerReleaseIdentity;
  readonly onInternalError?: (error: unknown, request: unknown) => void;
}

type AsyncRoute = (request: Request, response: Response) => Promise<void>;

export function createFaunapoolenApplication({
  authService,
  browserServing,
  campaignService,
  databaseReadiness,
  environment,
  generationService,
  identity,
  onInternalError = defaultInternalErrorLogger,
}: FaunapoolenApplicationOptions): express.Express {
  const app = express();
  hardenApplication(app);
  app.disable('etag');
  app.use(securityHeaders({ frameOptions: 'SAMEORIGIN' }));
  app.use(requestIdMiddleware());
  app.use(noindexHeader(PRIVATE_NOINDEX_PATHS));
  app.use(compression());

  app.get(
    '/healthz',
    healthMiddleware(FAUNAPOOLEN_PRODUCT_ID, environment.port, () => databaseReadiness.isReady()),
  );
  if (identity) app.get(SERVER_IDENTITY_PATH, serverReleaseIdentityMiddleware(identity));

  const originGuard = createOriginGuard({ allowedOrigins: environment.mutationOrigins });
  const jsonBody = express.json({ limit: ADMIN_REQUEST_BODY_LIMIT, strict: true });
  app.use(ADMIN_API_PATH, noStoreHeader());

  app.get(
    `${ADMIN_API_PATH}/session`,
    asyncRoute(async (request, response) => {
      const session = await authService.resolve(request.headers.cookie);
      response.status(200).json({ authenticated: session !== null });
    }),
  );
  app.post(
    `${ADMIN_API_PATH}/login`,
    originGuard,
    jsonBody,
    asyncRoute(async (request, response) => {
      const body = exactObject(request.body, ['password', 'username']);
      const result = await authService.login({
        clientKey: request.ip ?? request.socket.remoteAddress ?? 'unknown-client',
        password: requiredString(body['password'], 'password'),
        username: requiredString(body['username'], 'username'),
      });
      response.setHeader('Set-Cookie', result.setCookie);
      response.status(200).json({ ok: true });
    }),
  );
  app.post(
    `${ADMIN_API_PATH}/logout`,
    originGuard,
    asyncRoute(async (request, response) => {
      const result = await authService.logout(request.headers.cookie);
      response.setHeader('Set-Cookie', result.setCookie);
      response.status(200).json({ ok: true });
    }),
  );

  // Authentication makes the first decision for protected endpoints. A signed-out mutation stays
  // a 401 even when the caller also omits Origin or sends malformed JSON.
  app.use(ADMIN_API_PATH, requireOwnerSession(authService));
  app.use(ADMIN_API_PATH, originGuard);
  app.use(ADMIN_API_PATH, jsonBody);

  app.get(
    `${ADMIN_API_PATH}/config`,
    asyncRoute(async (_request, response) => {
      response.status(200).json(await campaignService.configuration());
    }),
  );
  app.get(
    `${ADMIN_API_PATH}/generations`,
    asyncRoute(async (_request, response) => {
      response.status(200).json({ generations: await generationService.listRecoverableStatuses() });
    }),
  );
  app.get(
    `${ADMIN_API_PATH}/campaigns`,
    asyncRoute(async (_request, response) => {
      response.status(200).json({ campaigns: await campaignService.listCampaigns() });
    }),
  );
  app.post(
    `${ADMIN_API_PATH}/campaigns`,
    asyncRoute(async (request, response) => {
      const body = exactObject(request.body, ['idea']);
      const generation = await generationService.createCampaign({
        idea: requiredString(body['idea'], 'idea'),
        ownerSessionIdHash: ownerSession(response).ownerSessionIdHash,
      });
      setRevisionEtag(response, generation.campaignRevision);
      response.status(202).json({ generation });
    }),
  );
  app.get(
    `${ADMIN_API_PATH}/campaigns/:id/status`,
    asyncRoute(async (request, response) => {
      const id = campaignId(request.params['id']);
      const status = await generationService.getStatus(id);
      if (!status) throw campaignNotFound();
      setRevisionEtag(response, status.campaignRevision);
      response.status(200).json({ status });
    }),
  );
  app.post(
    `${ADMIN_API_PATH}/campaigns/:id/retry`,
    asyncRoute(async (request, response) => {
      const id = campaignId(request.params['id']);
      const body = exactObject(request.body, ['expectedRevision', 'stage']);
      const result = await generationService.retryCampaign({
        campaignId: id,
        expectedRevision: generationRevision(body['expectedRevision']),
        ownerSessionIdHash: ownerSession(response).ownerSessionIdHash,
        stage: generationStage(body['stage']),
      });
      const generation = mutationValue(result);
      setRevisionEtag(response, generation.campaignRevision);
      response.status(202).json({ generation });
    }),
  );
  app.patch(
    `${ADMIN_API_PATH}/campaigns/:id/copy`,
    asyncRoute(async (request, response) => {
      const body = exactObject(request.body, ['expectedRevision', 'field', 'language', 'value']);
      const result = await campaignService.updateCopy({
        campaignId: campaignId(request.params['id']),
        expectedRevision: revision(body['expectedRevision']),
        field: safeField(body['field']),
        language: campaignLanguage(body['language']),
        value: copyValue(body['value']),
      });
      const updated = mutationValue(result);
      setRevisionEtag(response, updated.revision);
      response.status(200).json({
        ok: true,
        revision: updated.revision,
        updatedAt: updated.updatedAt,
      });
    }),
  );
  app.get(
    `${ADMIN_API_PATH}/campaigns/:id`,
    asyncRoute(async (request, response) => {
      const campaign = await campaignService.getCampaign(campaignId(request.params['id']));
      if (!campaign) throw campaignNotFound();
      setRevisionEtag(response, campaign.revision);
      response.status(200).json({ campaign });
    }),
  );
  app.delete(
    `${ADMIN_API_PATH}/campaigns/:id`,
    asyncRoute(async (request, response) => {
      mutationValue(
        await campaignService.deleteCampaign({
          expectedRevision: ifMatchRevision(request.headers['if-match']),
          id: campaignId(request.params['id']),
        }),
      );
      response.status(200).json({ ok: true });
    }),
  );
  app.use(ADMIN_API_PATH, apiNotFoundMiddleware());
  app.use('/api', apiNotFoundMiddleware());

  mountFaunapoolenBrowser(app, environment, browserServing);
  app.use((request, _response, next) => {
    next(notFoundError(request.originalUrl));
  });
  app.use(jsonErrorMiddleware({ onInternalError }));
  return app;
}

function asyncRoute(route: AsyncRoute) {
  return (request: Request, response: Response, next: NextFunction): void => {
    void route(request, response).catch(next);
  };
}

function requireOwnerSession(authService: OwnerAuthService) {
  return (request: Request, response: Response, next: NextFunction): void => {
    void authService
      .resolve(request.headers.cookie)
      .then((session) => {
        if (!session) {
          next(
            new HttpError({
              code: 'authentication_required',
              message: 'Your admin session has expired.',
              status: 401,
            }),
          );
          return;
        }
        response.locals['ownerSession'] = session;
        next();
      })
      .catch(next);
  };
}

function ownerSession(response: Response): AuthenticatedOwnerSession {
  const value = response.locals['ownerSession'];
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as { ownerSessionIdHash?: unknown }).ownerSessionIdHash !== 'string'
  ) {
    throw new Error('The authenticated owner session is missing from the response context.');
  }
  return value as AuthenticatedOwnerSession;
}

function exactObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidRequest('The request body must be a JSON object.');
  }
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw invalidRequest(`The request body must contain exactly: ${expected.join(', ')}.`);
  }
  return record;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length < 1) {
    throw invalidRequest(`${name} must be a non-empty string.`);
  }
  return value;
}

function campaignId(value: string | readonly string[] | undefined): string {
  if (typeof value !== 'string' || !CAMPAIGN_ID_PATTERN.test(value)) {
    throw invalidRequest('The campaign ID is invalid.');
  }
  return value;
}

function revision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw invalidRequest('expectedRevision must be a positive safe integer.');
  }
  return value as number;
}

function generationRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw invalidRequest('expectedRevision must be a non-negative safe integer.');
  }
  return value as number;
}

function ifMatchRevision(value: string | readonly string[] | undefined): number {
  if (value === undefined) {
    throw new HttpError({
      code: 'revision_required',
      message: 'Delete requests require one strong If-Match revision.',
      status: 428,
    });
  }
  if (typeof value !== 'string') {
    throw invalidRequest('If-Match must contain one strong campaign revision.');
  }
  const match = /^"([1-9][0-9]*)"$/.exec(value);
  if (!match) throw invalidRequest('If-Match must use the exact form "<revision>".');
  const parsed = Number(match[1]);
  if (!Number.isSafeInteger(parsed))
    throw invalidRequest('If-Match revision is outside the safe range.');
  return parsed;
}

function campaignLanguage(value: unknown): CampaignCopyUpdate['language'] {
  if (value !== 'sv' && value !== 'en') {
    throw invalidRequest('language must be exactly sv or en.');
  }
  return value;
}

function generationStage(value: unknown): GenerationStage {
  if (value !== 'strategy' && value !== 'copy' && value !== 'prompts') {
    throw invalidRequest('stage must be exactly strategy, copy, or prompts.');
  }
  return value;
}

function safeField(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z][A-Za-z0-9]{0,63}$/.test(value)) {
    throw invalidRequest('field must be a safe campaign copy field name.');
  }
  return value;
}

function copyValue(value: unknown): string | readonly string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length < 1 || copyLength(trimmed) > 4_000) {
      throw invalidRequest('Copy text must contain between 1 and 4000 characters.');
    }
    return trimmed;
  }
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 30 ||
    value.some(
      (entry) =>
        typeof entry !== 'string' || entry.trim().length < 1 || copyLength(entry.trim()) > 100,
    )
  ) {
    throw invalidRequest('Copy lists must contain 1 to 30 strings of at most 100 characters.');
  }
  return Object.freeze(value.map((entry) => (entry as string).trim()));
}

function mutationValue<T>(result: CampaignMutationResult<T>): T {
  if (isMutationFailure(result) && result.status === 'not_found') throw campaignNotFound();
  if (isMutationFailure(result) && result.status === 'revision_conflict') {
    throw new HttpError({
      code: 'revision_conflict',
      details: { currentRevision: result.currentRevision },
      message: 'The campaign changed after it was opened. Reload it and try again.',
      status: 409,
    });
  }
  return result as T;
}

function isMutationFailure(
  result: unknown,
): result is
  | { readonly status: 'not_found' }
  | { readonly currentRevision: number; readonly status: 'revision_conflict' } {
  if (!result || typeof result !== 'object') return false;
  const status = (result as { readonly status?: unknown }).status;
  return status === 'not_found' || status === 'revision_conflict';
}

function setRevisionEtag(response: Response, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Campaign responses require a non-negative safe revision.');
  }
  if (value === 0) return;
  response.setHeader('ETag', `"${String(value)}"`);
}

function campaignNotFound(): HttpError {
  return new HttpError({
    code: 'campaign_not_found',
    message: 'That campaign no longer exists.',
    status: 404,
  });
}

function invalidRequest(message: string): HttpError {
  return new HttpError({ code: 'invalid_request', message, status: 400 });
}

function defaultInternalErrorLogger(error: unknown, request: unknown): void {
  const context =
    request && typeof request === 'object'
      ? (request as {
          readonly method?: unknown;
          readonly path?: unknown;
          readonly requestId?: unknown;
        })
      : {};
  console.error('[faunapoolen] unhandled request error', {
    error,
    method: typeof context.method === 'string' ? context.method : undefined,
    path: typeof context.path === 'string' ? context.path : undefined,
    requestId: typeof context.requestId === 'string' ? context.requestId : undefined,
  });
}
