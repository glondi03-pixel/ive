/* ------------------------------------------------------------------
   Cloudflare Access check for the admin API.

   Access already blocks anyone who isn't logged in before the request
   reaches us. This is a second lock: we verify the signed login token
   Access attaches to every request, so the API stays closed even if
   the Access rule is ever misconfigured. If the two settings below are
   missing, every admin request is refused.

   Environment variables (Cloudflare Pages → Settings → Variables):
     ACCESS_TEAM_DOMAIN   e.g. "ive.cloudflareaccess.com"
     ACCESS_AUD           the "Application Audience (AUD) Tag" of the Access app
------------------------------------------------------------------ */

let cachedKeys = null;
let cachedAt = 0;

function b64urlToBytes(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function decodePart(s) {
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));
}

async function getKeys(team) {
    if (cachedKeys && Date.now() - cachedAt < 10 * 60 * 1000) return cachedKeys;
    const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
    if (!res.ok) throw new Error('Could not load Access certificates');
    cachedKeys = (await res.json()).keys || [];
    cachedAt = Date.now();
    return cachedKeys;
}

/* Returns the logged-in email, or null if the request is not authorised. */
export async function verifyAccess(request, env) {
    const team = (env.ACCESS_TEAM_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const aud = env.ACCESS_AUD;
    if (!team || !aud) return null;

    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    let header, payload;
    try {
        header = decodePart(parts[0]);
        payload = decodePart(parts[1]);
    } catch {
        return null;
    }

    const keys = await getKeys(team);
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk || header.alg !== 'RS256') return null;

    const key = await crypto.subtle.importKey(
        'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    );
    const ok = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5', key,
        b64urlToBytes(parts[2]),
        new TextEncoder().encode(parts[0] + '.' + parts[1])
    );
    if (!ok) return null;

    const now = Math.floor(Date.now() / 1000);
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!auds.includes(aud)) return null;
    if (payload.iss !== `https://${team}`) return null;
    if (!payload.exp || payload.exp < now) return null;

    return payload.email || 'unknown';
}
