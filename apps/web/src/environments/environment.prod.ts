/**
 * Production web config — API is a separate Vercel Nest project.
 *
 * Set API_ORIGIN to your API deployment URL (no trailing slash), e.g.:
 *   https://lms-api-xxxxx.vercel.app
 *
 * Create that project with Root Directory = apps/api (see README).
 */
const API_ORIGIN = 'https://YOUR-API-HOST';

export const environment = {
  production: true,
  appName: 'Zebl Training Portal',
  apiBaseUrl: `${API_ORIGIN}/api/v1`,
  mediaBaseUrl: API_ORIGIN,
};
