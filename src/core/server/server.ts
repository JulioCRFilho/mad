/**
 * HTTP server lifecycle for the MAD extension.
 *
 * Binds to 127.0.0.1 only (loopback) on a configurable port (0 = auto-assign).
 * Listens for POST /validate and GET /health requests from CLI agents.
 *
 * Security: Only listens on loopback — never exposed to the network.
 * Default port 0 means the OS picks a free port, avoiding conflicts.
 */

import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import * as vscode from 'vscode';
import { log } from '../log';
import { ValidateRequest, ValidateResponse } from './types';
import { validateFile } from './handler';

const PORT_FILE = '/tmp/mad-server.port';

let server: http.Server | null = null;
let serverPort: number | null = null;
let extensionUri: vscode.Uri | null = null;
let pkgVersion: string = '0.0.0';

function getConfigPort(): number {
    const config = vscode.workspace.getConfiguration('mad.server');
    return config.get<number>('port', 0);
}

function isEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('mad.server');
    return config.get<boolean>('enabled', true);
}

function sendJson(res: http.ServerResponse, statusCode: number, body: unknown): void {
    const json = JSON.stringify(body) + '\n';
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(json),
    });
    res.end(json);
}

function readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => {
            data += chunk;
        });
        req.on('end', () => resolve(data));
        req.on('error', err => reject(err));
    });
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // CORS headers — safe since we're loopback-only
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = req.url || '/';

    // GET /health — liveness check
    if (req.method === 'GET' && url === '/health') {
        log.info('[server] GET /health');
        sendJson(res, 200, {
            status: 'ok',
            version: pkgVersion,
        });
        return;
    }

    // POST /validate — full diagram validation
    // Query params: ?code=false omits mermaidCode from the response (lighter for validation loops)
    if (req.method === 'POST' && url.startsWith('/validate')) {
        try {
            const queryIndex = url.indexOf('?');
            const queryString = queryIndex >= 0 ? url.slice(queryIndex + 1) : '';
            const queryParams = new URLSearchParams(queryString);
            const omitCode = queryParams.get('code') === 'false';

            const body = await readBody(req);
            let request: ValidateRequest;
            try {
                request = JSON.parse(body);
            } catch {
                sendJson(res, 400, {
                    status: 'error',
                    errorType: 'internal_error',
                    message: 'Invalid JSON body',
                });
                return;
            }

            if (!request.filePath || typeof request.filePath !== 'string') {
                sendJson(res, 400, {
                    status: 'error',
                    errorType: 'internal_error',
                    message: 'Missing or invalid "filePath" field',
                });
                return;
            }

            log.info(`[server] POST /validate filePath=${request.filePath}${omitCode ? ' ?code=false' : ''}`);
            const result = validateFile(request.filePath);
            const statusCode = result.status === 'ok' ? 200 : 422;

            if (omitCode && result.status === 'ok') {
                const { mermaidCode, ...rest } = result;
                sendJson(res, statusCode, rest);
            } else {
                sendJson(res, statusCode, result);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log.error(`[server] Unhandled error: ${msg}`);
            sendJson(res, 500, {
                status: 'error',
                errorType: 'internal_error',
                message: msg,
            });
        }
        return;
    }

    // Unknown route
    sendJson(res, 404, {
        status: 'error',
        errorType: 'internal_error',
        message: `Not found: ${req.method} ${url}`,
    });
}

/**
 * Starts the HTTP server on 127.0.0.1:port.
 * Returns the actual port number (useful when port 0 was used for auto-assign).
 */
export async function startServer(context: vscode.ExtensionContext): Promise<number | null> {
    extensionUri = context.extensionUri;

    // Read package.json from the extension install directory (reliable regardless of compile output structure)
    try {
        const pkgPath = path.join(context.extensionUri.fsPath, 'package.json');
        const pkgRaw = fs.readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(pkgRaw);
        pkgVersion = pkg.version || '0.0.0';
    } catch (_) {
        pkgVersion = '0.0.0';
    }

    if (!isEnabled()) {
        log.info('[server] Server disabled via mad.server.enabled');
        return null;
    }

    if (server) {
        log.info(`[server] Server already running on port ${serverPort}`);
        return serverPort;
    }

    const port = getConfigPort();

    return new Promise((resolve, _reject) => {
        server = http.createServer((req, res) => {
            handleRequest(req, res).catch(err => {
                const msg = err instanceof Error ? err.message : String(err);
                if (!res.headersSent) {
                    sendJson(res, 500, {
                        status: 'error',
                        errorType: 'internal_error',
                        message: msg,
                    });
                }
            });
        });

        server.on('error', (err: NodeJS.ErrnoException) => {
            log.error(`[server] Failed to start: ${err.message}`);
            server = null;
            resolve(null);
        });

        server.listen(port, '127.0.0.1', () => {
            const addr = server!.address();
            if (addr && typeof addr === 'object') {
                serverPort = addr.port;
                // Write port to well-known file so CLI agents can discover it
                try {
                    fs.writeFileSync(PORT_FILE, String(serverPort) + '\n', 'utf-8');
                } catch (_) {
                    // Non-fatal — the port is still logged to the output channel
                }
                const autoMsg = port === 0 ? ' (auto-assigned)' : '';
                log.info(`[server] Listening on http://127.0.0.1:${serverPort}${autoMsg}`);
                vscode.window.showInformationMessage(
                    `🌐 MAD server: http://127.0.0.1:${serverPort} (agents can POST /validate)`
                );
            }
            resolve(serverPort);
        });

        // Cleanup on extension deactivation
        context.subscriptions.push({
            dispose: () => stopServer(),
        });
    });
}

/**
 * Stops the HTTP server gracefully.
 */
export function stopServer(): void {
    if (server) {
        log.info(`[server] Stopping server on port ${serverPort}`);
        server.close();
        server = null;
        serverPort = null;
    }
    // Clean up port file
    try {
        fs.unlinkSync(PORT_FILE);
    } catch (_) {
        // File may not exist — ignore
    }
}

/**
 * Returns the current server port, or null if not running.
 */
export function getServerPort(): number | null {
    return serverPort;
}

/**
 * Returns whether the server is currently running.
 */
export function isServerRunning(): boolean {
    return server !== null && serverPort !== null;
}