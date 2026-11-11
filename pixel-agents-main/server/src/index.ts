import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/api/health', async () => {
  return {
    status: 'OK',
    service: 'pixel-agents-internal-server',
    timestamp: new Date().toISOString(),
  };
});

export default app;
