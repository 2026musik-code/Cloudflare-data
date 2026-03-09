import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';

const app = new Hono<{ Bindings: { STORAGE: R2Bucket, GEMINI_API_KEY: string } }>();

// Proxy for Cloudflare API
app.all('/api/cloudflare/*', async (c) => {
  const token = c.req.header('Authorization');
  if (!token) {
    return c.json({ error: 'No API Token provided' }, 401);
  }

  const cfPath = c.req.path.replace('/api/cloudflare/', '');
  const url = `https://api.cloudflare.com/client/v4/${cfPath}`;
  
  const method = c.req.method;
  const query = c.req.query();
  const body = method !== 'GET' && method !== 'HEAD' ? await c.req.text() : undefined;

  const response = await fetch(`${url}${Object.keys(query).length ? '?' + new URLSearchParams(query) : ''}`, {
    method,
    headers: {
      'Authorization': token,
      'Content-Type': c.req.header('Content-Type') || 'application/json',
    },
    body,
  });

  const data = await response.text();
  try {
    return c.json(JSON.parse(data), response.status as any);
  } catch {
    return c.text(data, response.status as any);
  }
});

// Storage API (Example using R2)
app.get('/api/storage/:key', async (c) => {
  const key = c.req.param('key');
  const object = await c.env.STORAGE.get(key);
  if (!object) return c.notFound();
  return c.body(object.body);
});

app.put('/api/storage/:key', async (c) => {
  const key = c.req.param('key');
  const body = await c.req.arrayBuffer();
  await c.env.STORAGE.put(key, body);
  return c.json({ success: true });
});

// Serve static assets
app.get('/*', serveStatic({ root: './' }));

export default app;
