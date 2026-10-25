/* POST /api/contact — sends the contact form to Ive by email via Resend.

   Environment variables (Cloudflare → your Worker → Settings → Variables and Secrets):
     RESEND_API_KEY   secret API key from resend.com
     CONTACT_TO       where messages go, e.g. "ive.snijders@gmail.com"; when it is
                      not set, the email saved in the admin page is used
     CONTACT_FROM     optional sender. Until a domain is verified in Resend,
                      leave it empty: "onboarding@resend.dev" is used, which
                      can only deliver to the email of the Resend account.

   Nothing is stored: the message is passed straight to the email service. */

import { json } from '../../lib/events.js';
import { readSite } from '../../lib/site.js';

const TOPICS = { lessons: 'Lessons', booking: 'Concert / booking', press: 'Press & collaborations', other: 'Something else' };

const FIELDS = [
    ['phone', 'Phone'], ['language', 'Language'],
    ['student', 'Lessons for'], ['level', 'Level'], ['where', 'Where'],
    ['event_type', 'Type of event'], ['event_date', 'Event date'], ['venue', 'City / venue'], ['guests', 'Guests'],
    ['org', 'Publication / organisation'], ['deadline', 'Deadline']
];

function str(v, max) {
    return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export async function onRequestPost({ request, env }) {
    let d;
    try {
        d = await request.json();
    } catch {
        return json({ error: 'Bad request' }, 400);
    }

    // honeypot filled in → almost certainly a bot; pretend it worked
    if (str(d.website, 200)) return json({ ok: true });

    const name = str(d.name, 120);
    const email = str(d.email, 200);
    const message = str(d.message, 5000);
    const topic = TOPICS[d.topic] ? d.topic : 'other';

    if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || d.privacy !== true) {
        return json({ error: 'Please fill in the required fields.' }, 400);
    }

    const site = env.CONTACT_TO ? null : await readSite(env);
    const to = env.CONTACT_TO || (site && site.contact.email);
    if (!env.RESEND_API_KEY || !to) {
        return json({ error: 'The contact form is not configured yet.' }, 503);
    }

    const lines = [
        `Topic: ${TOPICS[topic]}`,
        `Name: ${name}`,
        `Email: ${email}`,
        ...FIELDS.map(([k, label]) => (str(d[k], 200) ? `${label}: ${str(d[k], 200)}` : null)).filter(Boolean),
        '',
        message,
        '',
        '—',
        'Sent from the contact form on the website. Reply to this email to answer directly.'
    ];

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from: env.CONTACT_FROM || 'Ive website <onboarding@resend.dev>',
            to: [to],
            reply_to: email,
            subject: `[${TOPICS[topic]}] ${name}`.replace(/[\r\n]/g, ' '),
            text: lines.join('\n')
        })
    });

    if (!res.ok) return json({ error: 'The message could not be sent.' }, 502);
    return json({ ok: true });
}
