// Relays browser API calls to providers that block CORS. Nothing is logged or stored.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'Retry-After',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(req) {
    if (new URL(req.url).pathname !== '/proxy') return new Response('Not found', { status: 404 });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (req.method !== 'POST') return new Response('POST only', { status: 405, headers: CORS });
    let target;
    try { target = new URL(req.headers.get('X-Target')); } catch { target = null; }
    if (target?.protocol !== 'https:' || !/\/(chat\/completions|systemone)$/.test(target.pathname))
      return new Response('X-Target must be an https URL ending in /chat/completions or /systemone', { status: 400, headers: CORS });
    const headers = new Headers();
    for (const [k, v] of req.headers) if (!/^(host|origin|referer|x-target|cf-|x-forwarded-|x-real-ip)/i.test(k)) headers.set(k, v);
    let res;
    try { res = await fetch(target, { method: 'POST', headers, body: req.body }); }
    catch (e) { return new Response('proxy could not reach provider: ' + e.message, { status: 502, headers: CORS }); }
    res = new Response(res.body, res);
    for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
    return res;
  },
};
