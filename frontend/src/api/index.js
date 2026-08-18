/**
 * Picks the data source. The rest of the app imports from here and never
 * knows which one is live.
 */
export const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false';

export { ApiError, client } from './client.js';
export * from './mock.js';
