/* ------------------------------------------------------------------
   Page texts Ive edits in the admin page (tab "Page texts").

   In public/, every editable piece of text carries data-t="key", e.g.
   <h1 data-t="home.hero.title">. The text in the HTML is the original;
   only the texts Ive changed are stored, in KV under the key "texts":

     { nl: { "home.hero.title": "…" }, en: { … }, updatedAt, updatedBy }

   A small text format, the same one the admin page writes:
     *word*        italics (in a big heading: the yellow italic word)
     [text](url)   link
     line break    new line (<br>); in data-k="paras" an empty line
                   starts a new paragraph, in data-k="list" every line
                   is one list item

   The admin page reads the originals by loading a page with ?original,
   which skips the saved texts.
------------------------------------------------------------------ */

export const TEXTS_KEY = 'texts';

const KEY = /^[a-z0-9][a-z0-9.-]{0,59}$/;
const MAX_KEYS = 400;
const MAX_LEN = 6000;

export async function readTexts(env, fresh = false) {
    if (!env.EVENTS) return null;
    const stored = await env.EVENTS.get(TEXTS_KEY, fresh ? { type: 'json' } : { type: 'json', cacheTtl: 60 });
    return stored && stored.nl && stored.en ? stored : null;
}

/* Returns a clean copy, or throws an Error with a readable message. */
export function cleanTexts(d) {
    if (!d || typeof d !== 'object' || typeof d.nl !== 'object' || typeof d.en !== 'object' || !d.nl || !d.en) {
        throw new Error('Expected Dutch and English texts');
    }
    const out = { nl: {}, en: {} };
    for (const lang of ['nl', 'en']) {
        const keys = Object.keys(d[lang]);
        if (keys.length > MAX_KEYS) throw new Error('Too many texts');
        for (const k of keys) {
            const v = d[lang][k];
            if (!KEY.test(k)) throw new Error(`Unknown text "${k}"`);
            if (typeof v !== 'string') throw new Error(`Text "${k}" must be text`);
            const s = v.replace(/\r\n?/g, '\n').trim();
            if (s.length > MAX_LEN) throw new Error(`Text "${k}" is longer than ${MAX_LEN} characters`);
            if (s) out[lang][k] = s;      // an empty box means: use the original
        }
    }
    return out;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const safeUrl = (u) => /^(https?:\/\/|mailto:|tel:|#|\/|[\w-]+\.html(#[\w-]*)?$)/i.test(u);

function inline(s, heading) {
    let h = esc(s)
        .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
            const u = url.replace(/&amp;/g, '&');
            return safeUrl(u) ? `<a href="${esc(u)}">${text}</a>` : text;
        });
    if (heading) {
        // the yellow italic word; keep it on one line with the punctuation after it
        h = h.replace(/\*([^*\n]+)\*([.,!?;:]*)/g, (m, w, p) => {
            const span = `<span class="accent-word">${w}</span>`;
            return p ? `<span class="nowrap">${span}${p}</span>` : span;
        });
    } else {
        h = h.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    }
    return h.replace(/\n/g, '<br>');
}

export function renderText(value, kind, tag) {
    const heading = tag === 'h1' || tag === 'h2';
    if (kind === 'paras') {
        return value.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${inline(p, false)}</p>`).join('');
    }
    if (kind === 'list') {
        return value.split('\n').map((l) => l.replace(/^\s*[-–—•]\s*/, '').trim()).filter(Boolean).map((l) => `<li>${inline(l, false)}</li>`).join('');
    }
    return inline(value, heading);
}

/* Adds the rule that puts Ive's saved texts into a page. */
export function textHandlers(rewriter, map) {
    return rewriter.on('[data-t]', {
        element(el) {
            const v = map[el.getAttribute('data-t')];
            if (v) el.setInnerContent(renderText(v, el.getAttribute('data-k'), el.tagName.toLowerCase()), { html: true });
        }
    });
}
