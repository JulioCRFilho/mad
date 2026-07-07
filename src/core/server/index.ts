//@::classDiagram

/**
 * Barrel export for the MAD HTTP server module.
 */
//@ServerModule:Re-export startServer function
export { startServer, stopServer, getServerPort, isServerRunning } from './server';
//@ServerModule1:Re-export validateFile handler
export { validateFile } from './handler';
//@ServerModule1.1:Re-export server types
export type { ValidateRequest, ValidateResponse, ValidateResponseSuccess, ValidateResponseError } from './types';