import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module'
import path from 'node:path'

const nodeRequire = createRequire(import.meta.url)

declare const process: { env: Record<string, string | undefined>; cwd: () => string };

function adminAiDevPlugin(): Plugin {
  return {
    name: 'admin-ai-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (url.startsWith('/api/admin/ai/')) {
          // Handle CORS preflight
          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
            res.end();
            return;
          }

          try {
            // Lazy load runtime using native Node createRequire to bypass esbuild ESM bundling restrictions
            const runtimePath = path.resolve(process.cwd(), 'backend', 'adminAiChatRuntime.js');
            const authPath = path.resolve(process.cwd(), 'backend', 'adminAuth.js');
            const runtime = nodeRequire(runtimePath);
            const { verifyAdminToken } = nodeRequire(authPath);

            const sendJson = (status: number, data: unknown) => {
              res.statusCode = status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            };

            const expressRes: any = res;
            expressRes.status = (code: number) => {
              res.statusCode = code;
              return {
                json: (data: unknown) => sendJson(code, data),
                send: (data: unknown) => {
                  res.end(data);
                }
              };
            };
            expressRes.json = (data: unknown) => sendJson(res.statusCode || 200, data);

            // Read JSON body for POST
            if (req.method === 'POST') {
              const buffers: Buffer[] = [];
              for await (const chunk of req) {
                buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
              }
              const rawBody = Buffer.concat(buffers).toString('utf8');
              try {
                (req as any).body = rawBody ? JSON.parse(rawBody) : {};
              } catch {
                return sendJson(400, { success: false, message: "Noto'g'ri JSON format" });
              }
            }

            // Verify admin authentication for protected endpoints
            const authHeader = (req.headers.authorization || '') as string;
            const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
            if (!verifyAdminToken(token)) {
              return sendJson(401, { success: false, message: 'Admin sessiyasi yaroqsiz yoki tugagan' });
            }

            // Route to appropriate handler
            const pathname = url.split('?')[0];
            if (pathname === '/api/admin/ai/chat' && req.method === 'POST') {
              return runtime.handleAdminAiChat(req as any, expressRes);
            }
            if (pathname === '/api/admin/ai/transcribe' && req.method === 'POST') {
              return runtime.handleAdminAiTranscribe(req as any, expressRes);
            }
            if (pathname === '/api/admin/ai/models' && req.method === 'GET') {
              return runtime.handleAdminAiModels(req as any, expressRes);
            }
            if (pathname === '/api/admin/ai/health' && req.method === 'GET') {
              return runtime.handleAdminAiHealth(req as any, expressRes);
            }

            return sendJson(404, { success: false, message: 'Topilmadi' });
          } catch (err: unknown) {
            console.error('Admin AI dev middleware error:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, message: 'Server ichki xatoligi' }));
            return;
          }
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), adminAiDevPlugin()],
  server: {
    host: '0.0.0.0', port: 3000, allowedHosts: true,
    proxy: { '/api': { target: process.env.VITE_API_URL || 'https://guli-lingerie-api.onrender.com', changeOrigin: true, secure: false } },
  },
  preview: { host: '0.0.0.0', port: 3000 },
})


