/* ------------------------------------------------------------------
   Site settings Ive edits in the admin page: contact details and fees.
   Stored in the same KV namespace as the events (binding EVENTS),
   under the key "site". Until the first save, the pages are served
   exactly as they are in public/ (the defaults below match them).
------------------------------------------------------------------ */

export const SITE_KEY = 'site';

// what the pages in public/ already say — shown in the admin until the first save
export const DEFAULTS = {
    contact: {
        email: 'ive.snijders@gmail.com',
        phone: '+31 61881945',
        address: 'Welsdaal 146C, Maastricht',
        kvk: '82057990',
        btw: 'NL003622875B09'
    },
    fees: [
        { name: 'Proefles', name_en: 'Trial lesson', note: 'Kennismaken, spelen, beslissen. Vrijblijvend.', note_en: 'Meet, play, decide. No obligation.', length: '30 min', price: 'gratis', price_en: 'free' },
        { name: 'Wekelijkse les', name_en: 'Weekly lesson', note: 'Beginners, kinderen, herintreders.', note_en: 'Beginners, children, returning players.', length: '45 min', price: '€ 48' },
        { name: 'Wekelijkse les', name_en: 'Weekly lesson', note: 'Gevorderd repertoire.', note_en: 'Intermediate and advanced repertoire.', length: '60 min', price: '€ 62' },
        { name: 'Voorbereiding conservatorium', name_en: 'Conservatory preparation', note: 'Twee lessen per week, inclusief theorie en proefaudities.', note_en: 'Two lessons a week, theory and mock auditions included.', length: '2 × 60 min', price: '€ 115 / week', price_en: '€ 115 / wk' },
        { name: 'Online les', name_en: 'Online lesson', note: 'Via videobellen, flexibel in te plannen.', note_en: 'Video call, flexible scheduling.', length: '45 min', price: '€ 45' },
        { name: 'Tienrittenkaart', name_en: 'Ten-lesson card', note: 'Voor een onregelmatig rooster, zes maanden geldig.', note_en: 'For irregular schedules, valid six months.', length: '10 × 45 min', price: '€ 450' }
    ]
};

export async function readSite(env, fresh = false) {
    if (!env.EVENTS) return null;
    const stored = await env.EVENTS.get(SITE_KEY, fresh ? { type: 'json' } : { type: 'json', cacheTtl: 60 });
    return stored && stored.contact && Array.isArray(stored.fees) ? stored : null;
}

function text(v, max, field, required = false) {
    const s = typeof v === 'string' ? v.trim() : v == null ? '' : null;
    if (s === null) throw new Error(`"${field}" must be text`);
    if (required && !s) throw new Error(`"${field}" is required`);
    if (s.length > max) throw new Error(`"${field}" is longer than ${max} characters`);
    return s;
}

/* Returns a clean copy of the settings, or throws an Error with a readable message. */
export function cleanSite(d) {
    if (!d || typeof d !== 'object' || !d.contact || !Array.isArray(d.fees)) throw new Error('Expected contact details and a list of fees');

    const c = d.contact;
    const contact = {
        email: text(c.email, 200, 'Email', true),
        phone: text(c.phone, 40, 'Phone'),
        // email, address and KvK number must be on a Dutch business website, so they can't be empty
        address: text(c.address, 200, 'Address', true),
        kvk: text(c.kvk, 20, 'KvK number', true),
        btw: text(c.btw, 30, 'VAT (btw) number')
    };
    if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(contact.email)) throw new Error('"Email" is not a valid email address');
    if (contact.phone && !/^\+?[\d\s()-]{6,}$/.test(contact.phone)) throw new Error('"Phone" may only contain digits, spaces, + ( ) and -');

    if (d.fees.length > 30) throw new Error('Too many fees (max 30)');
    const fees = d.fees.map((f, i) => {
        const where = `Fee ${i + 1}: `;
        try {
            if (!f || typeof f !== 'object') throw new Error('is empty');
            const out = {
                name: text(f.name, 80, 'name (Dutch)', true),
                name_en: text(f.name_en, 80, 'name (English)'),
                note: text(f.note, 200, 'note (Dutch)'),
                note_en: text(f.note_en, 200, 'note (English)'),
                length: text(f.length, 40, 'length'),
                price: text(f.price, 40, 'price'),
                price_en: text(f.price_en, 40, 'price (English)')
            };
            Object.keys(out).forEach((k) => out[k] === '' && delete out[k]);
            return out;
        } catch (err) {
            throw new Error(where + err.message);
        }
    });

    return { contact, fees };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function feeRows(fees, en) {
    return fees.map((f) => {
        const name = (en && f.name_en) || f.name;
        const note = (en && f.note_en) || f.note;
        const price = (en && f.price_en) || f.price || '';
        return `<tr><td>${esc(name)}${note ? `<small>${esc(note)}</small>` : ''}</td><td class="dur">${esc(f.length || '')}</td><td class="price">${esc(price)}</td></tr>`;
    }).join('');
}

/* Rewrites a page from public/ with the saved contact details and fees. */
export function applySite(response, site, en) {
    const c = site.contact;
    const values = { ...c, tel: (c.phone || '').replace(/[^\d+]/g, '') };

    return new HTMLRewriter()
        // optional details (phone, VAT number) left empty: hide the line or sentence around them
        .on('[data-if]', {
            element(el) {
                if (!values[el.getAttribute('data-if')]) el.remove();
            }
        })
        .on('[data-c]', {
            element(el) {
                const v = values[el.getAttribute('data-c')];
                if (v) el.setInnerContent(v);
            }
        })
        .on('a[data-ch]', {
            element(el) {
                const kind = el.getAttribute('data-ch');
                const href = el.getAttribute('href') || '';
                if (kind === 'email') el.setAttribute('href', href.replace(/^mailto:[^?]*/, 'mailto:' + values.email));
                if (kind === 'phone') el.setAttribute('href', 'tel:' + values.tel);
            }
        })
        .on('tbody[data-fees]', {
            element(el) {
                el.setInnerContent(feeRows(site.fees, en), { html: true });
            }
        })
        .transform(response);
}
