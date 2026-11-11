/* /api/admin/media — photos Ive uploads for his concerts.
   Stored in the same KV namespace as the events (binding EVENTS), one
   key per photo ("media:<id>"), served to visitors at /media/<id>.jpg
   by worker/index.js. The admin page shrinks photos before uploading,
   so each one is a few hundred KB.

   GET     list of uploaded photos
   POST    upload one photo (the request body is the image itself)
   DELETE  ?name=media/<id>.jpg removes one photo                     */

import { verifyAccess } from '../../../lib/access.js';
import { json, MEDIA_NAME } from '../../../lib/events.js';

const NO_STORE = { 'Cache-Control': 'no-store' };
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS = 200;

async function guard(request, env) {
    const email = await verifyAccess(request, env);
    if (!email) return { error: json({ error: 'Not logged in. Reload the page to log in again.' }, 401, NO_STORE) };
    if (!env.EVENTS) return { error: json({ error: 'Storage is not connected (KV binding "EVENTS" is missing).' }, 500, NO_STORE) };
    return { email };
}

async function listPhotos(env) {
    const photos = [];
    let cursor;
    do {
        const page = await env.EVENTS.list({ prefix: 'media:', cursor });
        page.keys.forEach((k) => photos.push({ name: 'media/' + k.name.slice(6), uploaded: k.metadata && k.metadata.uploaded }));
        cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    return photos.sort((a, b) => String(b.uploaded).localeCompare(String(a.uploaded)));
}

export async function onRequestGet({ request, env }) {
    const g = await guard(request, env);
    if (g.error) return g.error;
    return json({ photos: await listPhotos(env) }, 200, NO_STORE);
}

export async function onRequestPost({ request, env }) {
    const g = await guard(request, env);
    if (g.error) return g.error;

    const type = (request.headers.get('Content-Type') || '').split(';')[0].trim();
    if (!TYPES[type]) return json({ error: 'Only JPG, PNG or WebP photos can be uploaded.' }, 415, NO_STORE);

    const body = await request.arrayBuffer();
    if (!body.byteLength) return json({ error: 'The photo is empty.' }, 400, NO_STORE);
    if (body.byteLength > MAX_BYTES) return json({ error: 'The photo is too large (max 5 MB).' }, 413, NO_STORE);
    if ((await listPhotos(env)).length >= MAX_PHOTOS) {
        return json({ error: `There are already ${MAX_PHOTOS} photos. Delete a few old ones first.` }, 400, NO_STORE);
    }

    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const name = `media/${id}.${TYPES[type]}`;
    await env.EVENTS.put('media:' + id + '.' + TYPES[type], body, {
        metadata: { type, uploaded: new Date().toISOString(), by: g.email }
    });
    return json({ ok: true, name }, 200, NO_STORE);
}

export async function onRequestDelete({ request, env }) {
    const g = await guard(request, env);
    if (g.error) return g.error;
    const name = new URL(request.url).searchParams.get('name') || '';
    if (!MEDIA_NAME.test(name)) return json({ error: 'Unknown photo.' }, 400, NO_STORE);
    await env.EVENTS.delete('media:' + name.slice(6));
    return json({ ok: true }, 200, NO_STORE);
}

/* GET /media/<id>.jpg — the photo itself, for the public pages. */
export async function servePhoto(path, env) {
    const name = path.slice(1);
    if (!MEDIA_NAME.test(name) || !env.EVENTS) return null;
    const { value, metadata } = await env.EVENTS.getWithMetadata('media:' + name.slice(6), { type: 'arrayBuffer', cacheTtl: 3600 });
    if (!value) return null;
    return new Response(value, {
        headers: {
            'Content-Type': (metadata && metadata.type) || 'image/jpeg',
            // every upload gets a new name, so a photo never changes
            'Cache-Control': 'public, max-age=31536000, immutable'
        }
    });
}
