/**
 * Barrel export for the MAD HTTP server module.
 */
export { startServer, stopServer, getServerPort, isServerRunning } from './server';
export { validateFile } from './handler';
export type { ValidateRequest, ValidateResponse, ValidateResponseSuccess, ValidateResponseError } from './types';