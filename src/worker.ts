import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';

const app = new Hono<{ Bindings: { vpsai: any, GEMINI_API_KEY: string, ASSETS: any } }>();

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
  const object = await c.env.vpsai.get(key);
  if (!object) return c.notFound();
  return c.body(object.body);
});

app.put('/api/storage/:key', async (c) => {
  const key = c.req.param('key');
  const body = await c.req.arrayBuffer();
  await c.env.vpsai.put(key, body);
  return c.json({ success: true });
});

// Serve static assets
app.get('/*', (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
