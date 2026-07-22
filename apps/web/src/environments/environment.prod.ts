/**
 * Production web config.
 *
 * After deploying the Nest API on Railway (or Render), set API_ORIGIN to that
 * public origin — no trailing slash. Example:
 *   https://zebl-lms-api.up.railway.app
 */
const API_ORIGIN = 'https://YOUR-API-HOST';

export const environment = {
  production: true,
  appName: 'Zebl Training Portal',
  apiBaseUrl: `${API_ORIGIN}/api/v1`,
  mediaBaseUrl: API_ORIGIN,
};
