# Ive Snijders — website

Website for Ive Snijders, classical pianist and piano teacher in Maastricht, hosted on Cloudflare Workers (static files + a small Worker script).
Dutch is the main language (`/`), English lives under `/en/`. Every page is plain HTML. Ive changes five things himself at `/admin`,
and they are saved in Cloudflare KV:

- **Concerts**: shown on the Concerts page and in the "Binnenkort op het podium" band on the home page. Each concert has Dutch texts and optional English versions, and a photo: one of the site's own or one uploaded from the computer (shrunk in the browser, stored in KV, served at `/media/…`). Only date and title are required.
- **Page texts**: almost all visible texts on Home, Lessons, Concerts, Contact and the footer, in Dutch and English. Each editable element in `public/` carries `data-t="key"`; the text in the HTML is the original, and only the texts Ive changed are stored (`lib/texts.js`). The admin page reads the originals from the pages themselves (`?original` skips the saved texts). To make a new piece of text editable, give it a new `data-t` key in both the Dutch and English page (and a label in `TEXT_SECTIONS` in `admin/admin.js` if it starts a new section).
- **Fees**: the fees table on the Lessons page.
- **Contact details**: email, phone, address, KvK and btw number in the menu, footer, contact page and legal texts. Phone and btw may be empty; the lines mentioning them are then hidden.
- **Legal texts**: terms, privacy policy and cookie policy, in Dutch and English, section by section, in a small text format described at the top of `lib/legal.js`. Until the first save, `lib/legal-defaults.js` (the October 2026 texts) is used.

```
public/              the website (this folder is what gets published)
  index.html …       Dutch pages
  en/                English pages
  admin/             Ive's private website editor (protected by Cloudflare Access)
  data/events.js     starter concert list, used until the first save in /admin
                     and when opening the pages locally as files
  images/ fonts/     self-hosted photos and fonts (no Google requests)
  _headers           security headers
wrangler.jsonc       Cloudflare configuration (read on every deploy)
worker/index.js      Worker entry: answers /api/*, fills saved contact details and fees into the pages
functions/api/       request handlers
  events.js          GET  /api/events          public concert list
  admin/events.js    GET/PUT /api/admin/events read / save the concerts (login required)
  admin/site.js      GET/PUT /api/admin/site   read / save fees and contact details (login required)
  admin/media.js     GET/POST/DELETE /api/admin/media   uploaded concert photos (login required)
  admin/legal.js     GET/PUT /api/admin/legal  read / save the legal texts (login required)
  admin/texts.js     GET/PUT /api/admin/texts  read / save the page texts (login required)
  contact.js         POST /api/contact         sends the contact form by email
lib/                 shared code (login check, validation, page rewriting)
```

Until Ive saves fees or contact details for the first time, the pages show exactly what is in `public/`.

## Settings Cloudflare needs

| Name | Type | Value |
|---|---|---|
| `EVENTS` | KV namespace binding, set in `wrangler.jsonc` | the ID of a KV namespace, e.g. `ive-events` (holds concerts, fees and contact details) |
| `ACCESS_TEAM_DOMAIN` | variable | e.g. `ive.cloudflareaccess.com` |
| `ACCESS_AUD` | variable | Application Audience (AUD) tag of the Access app; several, comma-separated, are allowed |
| `RESEND_API_KEY` | secret | API key from resend.com |
| `CONTACT_TO` | variable, optional | inbox for contact-form messages; without it, the email saved in /admin is used |
| `CONTACT_FROM` | variable, optional | e.g. `Ive Snijders <website@yourdomain.nl>` once the domain is verified in Resend |

Variables go in Cloudflare → the Worker → Settings → Variables and Secrets (`keep_vars` in
`wrangler.jsonc` stops deploys from wiping them). Build settings: build command **empty**,
deploy command **`npx wrangler deploy`** (the default).

## Editing

Go to `https://<site>/admin` and log in with the one-time code Cloudflare emails you.
Pick a tab (Concerts, Fees, Contact details), make the changes, then press **Save & publish**.
The website shows the change within a minute. Past concerts move to "Recent" by themselves.

## Still to replace before going live

- The starter concerts in `data/events.js` are fictional: delete or replace them in /admin.
- The fees are placeholders: set the real ones in /admin.
- The "Waar ik in geloof / What I believe" points on the Lessons page and the studio piano photo.

## Domain and Google

The pages point search engines to **https://ivesnijders.com** (canonical links, hreflang, `sitemap.xml`,
structured data on the home page). Once the domain is connected:

1. Cloudflare → the Worker → Settings → Domains & Routes → add `ivesnijders.com` and `www.ivesnijders.com` as Custom Domains.
2. Zero Trust → Access: add the new domain to the admin app and put its AUD tag in `wrangler.jsonc` (after a comma).
3. Resend: verify the domain and set `CONTACT_FROM`, e.g. `Ive Snijders <website@ivesnijders.com>`.
4. Google Search Console: add the domain, submit `https://ivesnijders.com/sitemap.xml`.
5. Google Business Profile (category "Piano teacher" / "Pianoleraar", Maastricht): this is what makes the
   studio show up on the map for "pianoles Maastricht".

The structured data in the `<head>` of `index.html` and `en/index.html` repeats the email, phone and address; update it there too if those change.
