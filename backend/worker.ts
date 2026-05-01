export interface Env {
  CART_PARTNERS_BUCKET: R2Bucket;
  API_KEY: string;
}

const BACKUP_KEY = 'cart-partners.db';

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isAuthorized(request: Request, env: Env): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice('Bearer '.length);
  return token === env.API_KEY;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!isAuthorized(request, env)) {
      return unauthorized();
    }

    const url = new URL(request.url);

    // PUT /backup — upload the database file as base64 JSON
    if (url.pathname === '/backup' && request.method === 'PUT') {
      let body: { backup?: unknown };
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!body.backup || typeof body.backup !== 'string') {
        return new Response(JSON.stringify({ error: 'Missing or invalid "backup" field' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Decode base64 to binary
      let bytes: Uint8Array;
      try {
        const binaryStr = atob(body.backup);
        bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid base64 data' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      await env.CART_PARTNERS_BUCKET.put(BACKUP_KEY, bytes.buffer, {
        httpMetadata: { contentType: 'application/octet-stream' },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // GET /restore — download the database file as base64 JSON
    if (url.pathname === '/restore' && request.method === 'GET') {
      const object = await env.CART_PARTNERS_BUCKET.get(BACKUP_KEY);
      if (!object) {
        return new Response(JSON.stringify({ error: 'No backup found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const arrayBuffer = await object.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      return new Response(JSON.stringify({ backup: base64 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // GET /verify — check whether a backup exists in R2 without downloading it
    if (url.pathname === '/verify' && request.method === 'GET') {
      const object = await env.CART_PARTNERS_BUCKET.head(BACKUP_KEY);
      if (object) {
        return new Response(
          JSON.stringify({ success: true, key: BACKUP_KEY, size: object.size, uploaded: object.uploaded }),
          {
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      return new Response(JSON.stringify({ success: false, error: 'No backup found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
