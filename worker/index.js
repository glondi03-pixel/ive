/* ------------------------------------------------------------------
   Cloudflare Worker entry point.

   Every request comes through here first (run_worker_first in
   wrangler.jsonc):
   - the API routes below are answered by this script;
   - /media/… serves the photos Ive uploaded in the admin page;
   - pages are taken from public/ and get Ive's saved contact details,
     fees (lib/site.js) and legal texts (lib/legal.js) filled in;
   - everything else (images, fonts, CSS, the admin page) is served
     from public/ unchanged.
------------------------------------------------------------------ */

import * as events from '../functions/api/events.js';
import * as adminEvents from '../functions/api/admin/events.js';
import * as adminSite from '../functions/api/admin/site.js';
import * as adminMedia from '../functions/api/admin/media.js';
import * as contact from '../functions/api/contact.js';
import { json } from '../lib/events.js';
import * as adminLegal from '../functions/api/admin/legal.js';
import { readSite, siteHandlers, DEFAULTS } from '../lib/site.js';
import { readLegal, legalHandlers, legalPage } from '../lib/legal.js';

const ROUTES = {
    '/api/events': { GET: events.onRequestGet },
    '/api/admin/events': { GET: adminEvents.onRequestGet, PUT: adminEvents.onRequestPut },
    '/api/admin/site': { GET: adminSite.onRequestGet, PUT: adminSite.onRequestPut },
    '/api/admin/legal': { GET: adminLegal.onRequestGet, PUT: adminLegal.onRequestPut },
    '/api/admin/media': { GET: adminMedia.onRequestGet, POST: adminMedia.onRequestPost, DELETE: adminMedia.onRequestDelete },
    '/api/contact': { POST: contact.onRequestPost }
};

// same headers as public/_headers, set here because responses pass through the Worker
const SECURITY = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'"
};

function withHeaders(res, extra = {}) {
    const out = new Response(res.body, res);
    Object.entries({ ...SECURITY, ...extra }).forEach(([k, v]) => out.headers.set(k, v));
    return out;
}

async function page(request, env) {
    const path = new URL(request.url).pathname;
    const res = await env.ASSETS.fetch(request);

    if (path.startsWith('/admin')) {
        return withHeaders(res, { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' });
    }
    if (!(res.headers.get('Content-Type') || '').includes('text/html')) return withHeaders(res);

    const legal = legalPage(path);
    let site = null, texts = null;
    try {
        [site, texts] = await Promise.all([readSite(env), legal ? readLegal(env) : null]);
    } catch (err) {
        console.error(err);   // storage hiccup: serve the page as it is in public/
    }
    if (!site && !texts) return withHeaders(res);

    let rewriter = new HTMLRewriter();
    if (site) rewriter = siteHandlers(rewriter, site, path === '/en' || path.startsWith('/en/'));
    if (texts) rewriter = legalHandlers(rewriter, texts.docs[legal.page][legal.lang], legal.lang, (site || DEFAULTS).contact);

    // the saved details change the page, so it must not be cached as-is
    const out = withHeaders(rewriter.transform(res), { 'Cache-Control': 'no-cache' });
    out.headers.delete('ETag');
    out.headers.delete('Content-Length');
    return out;
}

export default {
    async fetch(request, env, ctx) {
        const path = new URL(request.url).pathname.replace(/\/+$/, '');
        const route = ROUTES[path];

        if (route) {
            const handler = route[request.method];
            if (!handler) return json({ error: 'Method not allowed' }, 405, { Allow: Object.keys(route).join(', ') });
            try {
                return await handler({ request, env, ctx });
            } catch (err) {
                console.error(err);
                return json({ error: 'Something went wrong on the server.' }, 500);
            }
        }

        if (path.startsWith('/media/') && (request.method === 'GET' || request.method === 'HEAD')) {
            const photo = await adminMedia.servePhoto(path, env).catch((err) => { console.error(err); return null; });
            if (photo) return withHeaders(photo);
        }

        return page(request, env);
    }
};
