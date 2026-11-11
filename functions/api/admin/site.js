/* /api/admin/site — read and save the contact details and fees.
   Protected the same way as the events API (see events.js next to this file). */

import { verifyAccess } from '../../../lib/access.js';
import { json } from '../../../lib/events.js';
import { readSite, cleanSite, DEFAULTS, SITE_KEY } from '../../../lib/site.js';

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
    const stored = await readSite(env, true);
    const site = stored || DEFAULTS;
    return json({ contact: site.contact, fees: site.fees, updatedAt: stored ? stored.updatedAt : null }, 200, NO_STORE);
}

export async function onRequestPut({ request, env }) {
    const g = await guard(request, env);
    if (g.error) return g.error;

    if (!(request.headers.get('Content-Type') || '').includes('application/json')) {
        return json({ error: 'Expected JSON' }, 415, NO_STORE);
    }

    let site;
    try {
        site = cleanSite(await request.json());
    } catch (err) {
        return json({ error: err instanceof SyntaxError ? 'The data could not be read.' : err.message }, 400, NO_STORE);
    }

    const record = { ...site, updatedAt: new Date().toISOString(), updatedBy: g.email };
    await env.EVENTS.put(SITE_KEY, JSON.stringify(record));

    return json({ ok: true, contact: site.contact, fees: site.fees, updatedAt: record.updatedAt }, 200, NO_STORE);
}
