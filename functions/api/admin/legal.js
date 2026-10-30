/* /api/admin/legal — read and save the terms, privacy policy and cookie policy.
   Protected the same way as the events API (see events.js next to this file). */

import { verifyAccess } from '../../../lib/access.js';
import { json } from '../../../lib/events.js';
import { readLegal, cleanLegal, LEGAL_DEFAULTS, LEGAL_KEY } from '../../../lib/legal.js';

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
    const stored = await readLegal(env, true);
    return json({ docs: stored ? stored.docs : LEGAL_DEFAULTS, updatedAt: stored ? stored.updatedAt : null }, 200, NO_STORE);
}

export async function onRequestPut({ request, env }) {
    const g = await guard(request, env);
    if (g.error) return g.error;

    if (!(request.headers.get('Content-Type') || '').includes('application/json')) {
        return json({ error: 'Expected JSON' }, 415, NO_STORE);
    }

    let docs;
    try {
        docs = cleanLegal((await request.json()).docs);
    } catch (err) {
        return json({ error: err instanceof SyntaxError ? 'The data could not be read.' : err.message }, 400, NO_STORE);
    }

    const record = { docs, updatedAt: new Date().toISOString(), updatedBy: g.email };
    await env.EVENTS.put(LEGAL_KEY, JSON.stringify(record));

    return json({ ok: true, docs, updatedAt: record.updatedAt }, 200, NO_STORE);
}
