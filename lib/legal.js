/* ------------------------------------------------------------------
   The terms, privacy policy and cookie policy, editable in /admin.

   Each page exists in Dutch and English. A page is an intro, two dates
   and a list of sections; each section has a heading, an optional short
   name for the contents list, and a body in a very small text format:

     blank line          new paragraph (a single line break stays a line break)
     - item              bullet list            1. item    numbered list
     | a | b |           table row (the first row is the header)
     > text              line in a framed box (the withdrawal form)
     **bold**            bold
     [text](address)     link
     {email} {phone} {address} {kvk} {btw}   the contact details from /admin;
                         a line with an empty {phone} or {btw} is left out

   Stored in KV (binding EVENTS) under the key "legal". Until the first
   save, the texts in lib/legal-defaults.js are used.
------------------------------------------------------------------ */

import { LEGAL_DEFAULTS } from './legal-defaults.js';

export const LEGAL_KEY = 'legal';
export const PAGES = ['terms', 'privacy', 'cookies'];
export const LANGS = ['nl', 'en'];
const PREFIX = { terms: 't-', privacy: 'p-', cookies: 'c-' };

export { LEGAL_DEFAULTS };

export async function readLegal(env, fresh = false) {
    if (!env.EVENTS) return null;
    const stored = await env.EVENTS.get(LEGAL_KEY, fresh ? { type: 'json' } : { type: 'json', cacheTtl: 60 });
    return stored && stored.docs ? stored : null;
}

/* --- validation ------------------------------------------------------ */

function text(v, max, field, required = false) {
    const s = typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim() : v == null ? '' : null;
    if (s === null) throw new Error(`"${field}" must be text`);
    if (required && !s) throw new Error(`"${field}" is required`);
    if (s.length > max) throw new Error(`"${field}" is longer than ${max} characters`);
    return s;
}

function slug(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'sectie';
}

/* Returns a clean copy of all six texts, or throws an Error with a readable message. */
export function cleanLegal(docs) {
    if (!docs || typeof docs !== 'object') throw new Error('Expected the legal texts');
    const out = {};
    for (const page of PAGES) {
        out[page] = {};
        for (const lang of LANGS) {
            const d = docs[page] && docs[page][lang];
            const where = `${page} (${lang.toUpperCase()}): `;
            try {
                if (!d || !Array.isArray(d.sections)) throw new Error('is missing');
                if (d.sections.length > 60) throw new Error('has more than 60 sections');
                const used = new Set();
                out[page][lang] = {
                    intro: text(d.intro, 800, 'intro'),
                    updated: text(d.updated, 40, 'last updated'),
                    validFrom: text(d.validFrom, 40, 'in force from'),
                    sections: d.sections.map((s, i) => {
                        const title = text(s && s.title, 150, `heading of section ${i + 1}`, true);
                        // keep existing anchors (other pages link to them); new sections get one from their heading
                        let id = typeof s.id === 'string' && /^[a-z0-9-]{1,60}$/.test(s.id) ? s.id : PREFIX[page] + slug(title);
                        while (used.has(id)) id += '-2';
                        used.add(id);
                        const sec = { id, title, body: text(s.body, 20000, `text of "${title}"`) };
                        const short = text(s.short, 60, `short name of "${title}"`);
                        if (short && short !== title) sec.short = short;
                        return sec;
                    })
                };
            } catch (err) {
                throw new Error(where + err.message);
            }
        }
    }
    return out;
}

/* --- rendering ------------------------------------------------------- */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SAFE_URL = /^(https?:\/\/|mailto:|tel:|#|[\w-]+\.html(#[\w-]+)?$)/i;

function inline(s, c) {
    return esc(s)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
            const u = url.replace(/&amp;/g, '&');
            if (!SAFE_URL.test(u)) return label;
            return `<a href="${esc(u)}"${/^https?:/i.test(u) ? ' rel="noopener"' : ''}>${label}</a>`;
        })
        .replace(/\{(email|phone|address|kvk|btw)\}/g, (m, k) =>
            k === 'email' ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : esc(c[k] || ''));
}

// a line that mentions an empty optional detail is left out
const keepLine = (c) => (line) => !/\{(phone|btw)\}/.test(line) || ['phone', 'btw'].every((k) => !line.includes(`{${k}}`) || c[k]);

function blocks(body, c) {
    return body.split(/\n\s*\n/).map((b) => {
        const lines = b.split('\n').map((l) => l.trim()).filter(Boolean).filter(keepLine(c));
        if (!lines.length) return '';
        if (lines.every((l) => /^[-•]\s/.test(l))) {
            return '<ul>' + lines.map((l) => `<li>${inline(l.replace(/^[-•]\s+/, ''), c)}</li>`).join('') + '</ul>';
        }
        if (lines.every((l) => /^\d+[.)]\s/.test(l))) {
            return '<ol>' + lines.map((l) => `<li>${inline(l.replace(/^\d+[.)]\s+/, ''), c)}</li>`).join('') + '</ol>';
        }
        if (lines.every((l) => l.startsWith('|'))) {
            const rows = lines.map((l) => l.replace(/^\||\|$/g, '').split('|').map((x) => x.trim()));
            const [head, ...rest] = rows;
            return '<table class="tbl"><thead><tr>' + head.map((x) => `<th>${inline(x, c)}</th>`).join('') + '</tr></thead><tbody>' +
                rest.map((r) => '<tr>' + r.map((x) => `<td>${inline(x, c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
        }
        if (lines.every((l) => l.startsWith('>'))) {
            return '<div class="model-form">' + lines.map((l) => `<p>${inline(l.replace(/^>\s?/, ''), c)}</p>`).join('') + '</div>';
        }
        return '<p>' + lines.map((l) => inline(l, c)).join('<br>') + '</p>';
    }).join('');
}

const WORDS = {
    nl: { updated: 'Laatst bijgewerkt', from: 'Geldig vanaf', count: (n) => `${n} ${n === 1 ? 'onderdeel' : 'onderdelen'}` },
    en: { updated: 'Last updated', from: 'In force from', count: (n) => `${n} ${n === 1 ? 'section' : 'sections'}` }
};

/* Fills a legal page (terms / privacy / cookies) with the given text. */
export function legalHandlers(rewriter, doc, lang, contact) {
    const w = WORDS[lang];
    const meta = (doc.updated ? `<span>${w.updated} <b>${esc(doc.updated)}</b></span>` : '') +
        (doc.validFrom ? `<span>${w.from} <b>${esc(doc.validFrom)}</b></span>` : '');
    const parts = {
        intro: inline(doc.intro, contact),
        meta,
        count: esc(w.count(doc.sections.length)),
        toc: doc.sections.map((s) => `<li><a href="#${esc(s.id)}">${esc(s.short || s.title)}</a></li>`).join(''),
        body: doc.sections.map((s) =>
            `<section class="clause" id="${esc(s.id)}"><div><h2>${esc(s.title)}</h2>${blocks(s.body, contact)}</div></section>`).join('')
    };
    return rewriter.on('[data-legal]', {
        element(el) {
            const part = el.getAttribute('data-legal');
            if (part === 'meta' && !meta) el.remove();
            else if (part in parts) el.setInnerContent(parts[part], { html: true });
        }
    });
}

/* "/en/privacy" → { page: 'privacy', lang: 'en' }, or null for other pages */
export function legalPage(path) {
    const m = /^\/(en\/)?(terms|privacy|cookies)(\.html)?$/.exec(path);
    return m ? { page: m[2], lang: m[1] ? 'en' : 'nl' } : null;
}
