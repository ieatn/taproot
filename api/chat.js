import { handleChatRequest } from '../server/handleChatRequest.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    const body =
      typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(req.body || '{}');
    const result = await handleChatRequest(body);
    res.statusCode = 200;
    res.end(JSON.stringify(result));
  } catch (err) {
    const status = Number(err.statusCode) || 400;
    res.statusCode = status;
    res.end(JSON.stringify({ error: err.message || 'Bad request' }));
  }
}
