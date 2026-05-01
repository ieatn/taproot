import { defineConfig, loadEnv } from 'vite';
import { geminiChatMiddleware } from './server/gemini-middleware.js';

export default defineConfig(({ mode }) => {
  const loaded = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(loaded)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return {
    publicDir: 'public',
    server: {
      host: true,
      port: 5173,
      strictPort: false,
    },
    plugins: [
      {
        name: 'gemini-chat-api',
        configureServer(server) {
          server.middlewares.use(geminiChatMiddleware());
        },
        configurePreviewServer(server) {
          server.middlewares.use(geminiChatMiddleware());
        },
      },
    ],
  };
});
