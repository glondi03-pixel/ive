/* /api/admin/texts — read and save the page texts Ive changed (see lib/texts.js).
   Protected the same way as the events API (see events.js next to this file). */

import { verifyAccess } from '../../../lib/access.js';
import { json } from '../../../lib/events.js';
import { readTexts, cleanTexts, TEXTS_KEY } from '../../../lib/texts.js';

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
    const stored = await readTexts(env, true);
    return json({ nl: stored ? stored.nl : {}, en: stored ? stored.en : {}, updatedAt: stored ? stored.updatedAt : null }, 200, NO_STORE);
}

export async function onRequestPut({ request, env }) {
    const g = await guard(request, env);
    if (g.error) return g.error;

    if (!(request.headers.get('Content-Type') || '').includes('application/json')) {
        return json({ error: 'Expected JSON' }, 415, NO_STORE);
    }

    let texts;
    try {
        texts = cleanTexts(await request.json());
    } catch (err) {
        return json({ error: err instanceof SyntaxError ? 'The data could not be read.' : err.message }, 400, NO_STORE);
    }

    const record = { ...texts, updatedAt: new Date().toISOString(), updatedBy: g.email };
    await env.EVENTS.put(TEXTS_KEY, JSON.stringify(record));

    return json({ ok: true, nl: texts.nl, en: texts.en, updatedAt: record.updatedAt }, 200, NO_STORE);
}
