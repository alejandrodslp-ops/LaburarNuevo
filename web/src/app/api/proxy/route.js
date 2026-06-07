export const runtime = 'edge';

const SECRET = process.env.PROXY_SECRET ?? '';

const ALLOWED = new Set([
  'bo.computrabajo.com', 'ec.computrabajo.com', 'py.computrabajo.com',
  've.computrabajo.com', 'cr.computrabajo.com', 'sv.computrabajo.com',
  'ni.computrabajo.com', 'pa.computrabajo.com', 'do.computrabajo.com',
  'ar.computrabajo.com', 'cl.computrabajo.com', 'co.computrabajo.com',
  'pe.computrabajo.com', 'mx.computrabajo.com', 'hn.computrabajo.com',
  'gt.computrabajo.com', 'cu.computrabajo.com',
  'dof.gob.mx', 'www.dof.gob.mx',
  'cnsc.gov.co', 'www.cnsc.gov.co',
  'jobs.gc.ca', 'emplois.gc.ca',
]);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('t') ?? request.headers.get('x-proxy-token') ?? '';
  if (SECRET && token !== SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const target = searchParams.get('url');
  if (!target) return new Response('Missing ?url=', { status: 400 });

  let parsed;
  try { parsed = new URL(target); } catch { return new Response('Invalid URL', { status: 400 }); }

  if (!ALLOWED.has(parsed.hostname)) {
    return new Response(`Host not allowed: ${parsed.hostname}`, { status: 403 });
  }

  try {
    const res = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
        'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'text/html',
        'X-Proxy-Status': String(res.status),
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
