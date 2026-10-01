import Fastify from 'fastify';
import pg from 'pg';
export const app = Fastify({ logger: { redact: ['req.headers.authorization', 'req.headers.cookie'] } });
const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'], connectionTimeoutMillis: 1000 });
app.get('/api/health', async () => ({ status: 'ok', stage: 'G0', service: 'api' }));
app.get('/api/ready', async (_request, reply) => {
  try {
    await pool.query('SELECT 1');
    const response = await fetch(`${process.env['OBJECT_ENDPOINT']}/minio/health/ready`, { signal: AbortSignal.timeout(1000) });
    if (!response.ok) throw new Error('object store unavailable');
    return { status: 'ready' };
  } catch { return reply.code(503).send({ status: 'notReady' }); }
});
app.addHook('onClose', async () => { await pool.end(); });
await app.listen({ host: process.env['API_HOST'] ?? '127.0.0.1', port: Number(process.env['API_PORT'] ?? 3001) });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void app.close(); });
