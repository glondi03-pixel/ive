/* GET /api/events — public list of events for the website.
   Returns { events: null } until Ive saves for the first time; the site
   then falls back to the starter list in public/data/events.js. */

import { json, readEvents } from '../../lib/events.js';

export async function onRequestGet({ env }) {
    const stored = await readEvents(env);
    return json(
        { events: stored ? stored.events : null, updatedAt: stored ? stored.updatedAt : null },
        200,
        { 'Cache-Control': 'public, max-age=30' }
    );
}
