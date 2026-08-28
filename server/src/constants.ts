export const FAUNAPOOLEN_PRODUCT_ID = 'faunapoolen';

export const FAUNAPOOLEN_PUBLIC_ORIGIN = 'https://faunapoolen.se';
export const FAUNAPOOLEN_WWW_ORIGIN = 'https://www.faunapoolen.se';
export const DEFAULT_OPENAI_MODEL = 'gpt-5.6-terra';

export const ADMIN_API_PATH = '/api/admin';
export const ADMIN_SESSION_COOKIE = 'fp_admin_session';
export const ADMIN_SESSION_APPLICATION_ID = 'faunapoolen';
export const ADMIN_SESSION_SIGNING_KEY_ID = 'primary';
export const ADMIN_SESSION_DEFAULT_TTL_SECONDS = 8 * 60 * 60;
export const ADMIN_SESSION_MAXIMUM_TTL_SECONDS = 24 * 60 * 60;
export const ADMIN_REQUEST_BODY_LIMIT = '16kb';

export const CAMPAIGN_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const PRIVATE_NOINDEX_PATHS = Object.freeze([
  '/admin',
  '/en/admin',
  '/admin-auth',
  ADMIN_API_PATH,
]);
