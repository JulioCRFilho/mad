//@::graph TD

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
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => resolve(data));
        req.on('error', err => reject(err));
    });
}

//@RequestRouter:Handle incoming HTTP request — route to endpoint
async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    //@RequestRouter1:Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = req.url || '/';

    //@RequestRouter1->RequestRouter2:Route GET /health
    //@RequestRouter2:Serve health check with version info
    if (req.method === 'GET' && url === '/health') {
        log.info('[server] GET /health');
        sendJson(res, 200, { status: 'ok', version: pkgVersion });
        return;
    }

    //@RequestRouter1->RequestRouter3:Route POST /validate
    //@RequestRouter3:Parse body and validate file path
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
                sendJson(res, 400, { status: 'error', errorType: 'internal_error', message: 'Invalid JSON body' });
                return;
            }

            if (!request.filePath || typeof request.filePath !== 'string') {
                sendJson(res, 400, { status: 'error', errorType: 'internal_error', message: 'Missing or invalid "filePath" field' });
                return;
            }

            log.info(`[server] POST /validate filePath=${request.filePath}${omitCode ? ' ?code=false' : ''}`);
            //@RequestRouter3->RequestRouter4:Call validateFile and respond
            //@RequestRouter4:Validation result sent to client
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
            sendJson(res, 500, { status: 'error', errorType: 'internal_error', message: msg });
        }
        return;
    }

    //@RequestRouter1->RequestRouter5:Return 404 for unknown routes
    //@RequestRouter5:404 returned
    sendJson(res, 404, { status: 'error', errorType: 'internal_error', message: `Not found: ${req.method} ${url}` });
}

//@StartServer
export async function startServer(context: vscode.ExtensionContext): Promise<number | null> {
    extensionUri = context.extensionUri;

    //@StartServer1:Read package.json to get version
    try {
        const pkgPath = path.join(context.extensionUri.fsPath, 'package.json');
        const pkgRaw = fs.readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(pkgRaw);
        pkgVersion = pkg.version || '0.0.0';
    } catch (_) {
        pkgVersion = '0.0.0';
    }

    //@StartServer1->StartServer2:Check if server is enabled in config
    //@StartServer2:Enabled check passed (or disabled — return null)
    if (!isEnabled()) {
        log.info('[server] Server disabled via mad.server.enabled');
        return null;
    }

    //@StartServer2->StartServer3:Check if server is already running
    //@StartServer3:Not already running — proceed to create
    if (server) {
        log.info(`[server] Server already running on port ${serverPort}`);
        return serverPort;
    }

    const port = getConfigPort();

    return new Promise((resolve, _reject) => {
        //@StartServer3->StartServer4:Create HTTP server instance
        //@StartServer4:HTTP server created
        server = http.createServer((req, res) => {
            handleRequest(req, res).catch(err => {
                const msg = err instanceof Error ? err.message : String(err);
                if (!res.headersSent) {
                    sendJson(res, 500, { status: 'error', errorType: 'internal_error', message: msg });
                }
            });
        });

        //@StartServer4->StartServer5:Register error handler
        //@StartServer5:Error handler registered
        server.on('error', (err: NodeJS.ErrnoException) => {
            log.error(`[server] Failed to start: ${err.message}`);
            server = null;
            resolve(null);
        });

        //@StartServer4->StartServer6:Bind to loopback port and write port file
        //@StartServer6:Server listening — port file written
        server.listen(port, '127.0.0.1', () => {
            const addr = server!.address();
            if (addr && typeof addr === 'object') {
                serverPort = addr.port;
                try {
                    fs.writeFileSync(PORT_FILE, String(serverPort) + '\n', 'utf-8');
                } catch (_) {}
                const autoMsg = port === 0 ? ' (auto-assigned)' : '';
                log.info(`[server] Listening on http://127.0.0.1:${serverPort}${autoMsg}`);
                vscode.window.showInformationMessage(
                    `🌐 MAD server: http://127.0.0.1:${serverPort} (agents can POST /validate)`
                );
            }
            resolve(serverPort);
        });

        //@StartServer6->StartServer7:Register cleanup on deactivation
        //@StartServer7:Cleanup handler registered
        context.subscriptions.push({ dispose: () => stopServer() });
    });
}

//@StopServer
export function stopServer(): void {
    //@StopServer1:Close server if running
    if (server) {
        log.info(`[server] Stopping server on port ${serverPort}`);
        server.close();
        server = null;
        serverPort = null;
    }
    //@StopServer1->StopServer2:Remove port file
    //@StopServer2:Port file cleaned up
    try {
        fs.unlinkSync(PORT_FILE);
    } catch (_) {}
}

export function getServerPort(): number | null {
    return serverPort;
}

export function isServerRunning(): boolean {
    return server !== null && serverPort !== null;
}