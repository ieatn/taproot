import { handleChatRequest } from './handleChatRequest.js';

export function geminiChatMiddleware() {
  return async function geminiChat(req, res, next) {
    const url = req.url?.split('?')[0];
    if (url !== '/api/chat') {
      next();
      return;
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    let payload = '';
    req.on('data', (chunk) => {
      payload += chunk;
      if (payload.length > 400_000) req.destroy();
    });

    req.on('end', async () => {
      res.setHeader('Content-Type', 'application/json');
      try {
        const body = payload ? JSON.parse(payload) : {};
        const result = await handleChatRequest(body);
        res.statusCode = 200;
        res.end(JSON.stringify(result));
      } catch (err) {
        const status = Number(err.statusCode) || 400;
        res.statusCode = status;
        res.end(JSON.stringify({ error: err.message || 'Bad request' }));
      }
    });

    req.on('error', () => {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Bad request' }));
    });
  };
}
