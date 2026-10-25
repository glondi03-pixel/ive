/* ------------------------------------------------------------------
   Shared helpers for the events API: storage, validation, responses.
   Events live in the KV namespace bound as EVENTS, under one key.
------------------------------------------------------------------ */

export const KV_KEY = 'events';

// photos Ive can pick for an event (files in public/images)
export const IMAGES = [
    'backstage.jpg', 'lid-lean.jpg', 'mirror.jpg', 'piano-open.jpg',
    'playing.jpg', 'portrait-piano.jpg', 'portrait-wall.jpg', 'profile-piano.jpg', 'reflection.jpg'
];

export function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
    });
}

export async function readEvents(env) {
    if (!env.EVENTS) return null;
    const stored = await env.EVENTS.get(KV_KEY, 'json');
    return stored && Array.isArray(stored.events) ? stored : null;
}

function text(v, max, field, required = false) {
    if (v == null || v === '') {
        if (required) throw new Error(`"${field}" is required`);
        return undefined;
    }
    if (typeof v !== 'string') throw new Error(`"${field}" must be text`);
    const s = v.trim();
    if (required && !s) throw new Error(`"${field}" is required`);
    if (s.length > max) throw new Error(`"${field}" is longer than ${max} characters`);
    return s || undefined;
}

function match(v, re, field, msg) {
    if (v === undefined) return undefined;
    if (!re.test(v)) throw new Error(`"${field}" ${msg}`);
    return v;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const URL_OK = /^(https?:\/\/|mailto:|tel:|\/|#|[\w-]+\.html)/i;

/* Returns a clean copy of the list, or throws an Error with a readable message. */
export function cleanEvents(list) {
    if (!Array.isArray(list)) throw new Error('Expected a list of events');
    if (list.length > 300) throw new Error('Too many events (max 300)');

    return list.map((e, i) => {
        const name = e && typeof e.title === 'string' && e.title.trim() ? e.title.replace(/\*/g, '').trim() : `Event ${i + 1}`;
        const where = `${name}: `;
        try {
            if (!e || typeof e !== 'object') throw new Error('is empty');
            const out = {};

            out.date = match(text(e.date, 10, 'date', true), /^\d{4}-\d{2}-\d{2}$/, 'date', 'must look like 2026-11-14');
            if (isNaN(new Date(out.date + 'T12:00:00Z'))) throw new Error('"date" is not a real date');
            out.time = match(text(e.time, 5, 'time'), TIME, 'time', 'must look like 20:15');
            out.doors = match(text(e.doors, 5, 'doors'), TIME, 'doors', 'must look like 19:45');

            if (e.durationMin !== undefined && e.durationMin !== null && e.durationMin !== '') {
                const d = Number(e.durationMin);
                if (!Number.isInteger(d) || d < 1 || d > 600) throw new Error('"duration" must be minutes between 1 and 600');
                out.durationMin = d;
            }

            out.title = text(e.title, 200, 'title', true);
            out.description = text(e.description, 1500, 'description');
            out.venue = text(e.venue, 120, 'venue');
            out.city = text(e.city, 80, 'city', true);
            out.price = text(e.price, 120, 'price');
            out.access = text(e.access, 120, 'access');
            out.status = text(e.status, 80, 'status');

            // optional English versions, shown on the /en/ pages
            out.title_en = text(e.title_en, 200, 'title (English)');
            out.description_en = text(e.description_en, 1500, 'description (English)');
            out.venue_en = text(e.venue_en, 120, 'venue (English)');
            out.price_en = text(e.price_en, 120, 'price (English)');
            out.access_en = text(e.access_en, 120, 'access (English)');
            out.status_en = text(e.status_en, 80, 'status (English)');

            if (e.image) {
                if (!IMAGES.includes(e.image)) throw new Error('"image" is not one of the site photos');
                out.image = e.image;
            }

            if (e.link && (e.link.url || e.link.label)) {
                const url = match(text(e.link.url, 500, 'link address', true), URL_OK, 'link address', 'must start with https://');
                out.link = { label: text(e.link.label, 40, 'button text') || 'Kaarten', url };
                const labelEn = text(e.link.label_en, 40, 'button text (English)');
                if (labelEn) out.link.label_en = labelEn;
            }

            if (Array.isArray(e.programme) && e.programme.length) {
                if (e.programme.length > 30) throw new Error('programme has more than 30 pieces');
                out.programme = e.programme
                    .map((p) => ({
                        composer: text(p && p.composer, 120, 'composer'),
                        work: text(p && p.work, 200, 'work'),
                        duration: text(p && p.duration, 20, 'piece duration')
                    }))
                    .filter((p) => p.composer || p.work);
                if (!out.programme.length) delete out.programme;
            }

            // drop empty fields so the stored JSON stays tidy
            Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
            return out;
        } catch (err) {
            throw new Error(where + err.message);
        }
    });
}
