/* /api/admin/events — read and save the full events list.
   Protected twice: by the Cloudflare Access rule on /api/admin, and by
   verifying the Access login token here (lib/access.js). */

import { verifyAccess } from '../../../lib/access.js';
import { json, readEvents, cleanEvents, KV_KEY } from '../../../lib/events.js';

const NO_STORE = { 'Cache-Control': 'no-store' };

async function guard(request, env) {
    const email = await verifyAccess(request, env);
    if (!email) return { error: json({ error: 'Not logged in. Reload the page to log in again.' }, 401, NO_STORE) };
    if (!env.EVENTS) return { error: json({ error: 'Storage is not connected (KV binding "EVENTS" is missing).' }, 500, NO_STORE) };
    return { email };
}

export async function onRequestGet({ request, env }) {
    const g = await guard(request, env);
    if (g.error) return g.error;
    const stored = await readEvents(env);
    return json({ events: stored ? stored.events : null, updatedAt: stored ? stored.updatedAt : null, user: g.email }, 200, NO_STORE);
}

export async function onRequestPut({ request, env }) {
    const g = await guard(request, env);
    if (g.error) return g.error;

    if (!(request.headers.get('Content-Type') || '').includes('application/json')) {
        return json({ error: 'Expected JSON' }, 415, NO_STORE);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: 'The data could not be read.' }, 400, NO_STORE);
    }

    let events;
    try {
        events = cleanEvents(body && body.events);
    } catch (err) {
        return json({ error: err.message }, 400, NO_STORE);
    }

    events.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    const record = { events, updatedAt: new Date().toISOString(), updatedBy: g.email };
    await env.EVENTS.put(KV_KEY, JSON.stringify(record));

    return json({ ok: true, events, updatedAt: record.updatedAt }, 200, NO_STORE);
}
