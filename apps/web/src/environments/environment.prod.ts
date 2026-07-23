/**
 * Production web config — Nest API on Vercel project `lms-api`.
 */
const API_ORIGIN = 'https://zebl-lms.vercel.app';

export const environment = {
  production: true,
  appName: 'Zebl Training Portal',
  apiBaseUrl: `${API_ORIGIN}/api/v1`,
  mediaBaseUrl: API_ORIGIN,
};
