# Ive — website

Static site for Ive, classical pianist and piano teacher, hosted on Cloudflare Pages.
Every page is plain HTML. The only part that changes is the concert list, which Ive edits
at `/admin`. It is saved in Cloudflare KV and read by the Events page and the
"Next on stage" band on the home page.

```
public/              the website (this folder is what gets published)
  index.html …       pages
  admin/             Ive's private events editor (protected by Cloudflare Access)
  data/events.js     starter concert list — used until the first save in /admin,
                     and when opening the pages locally as files
  images/ fonts/     self-hosted photos and fonts (no Google requests)
  _headers           security headers; keeps *.pages.dev out of search engines
functions/api/       server code (Cloudflare Pages Functions)
  events.js          GET  /api/events          public concert list
  admin/events.js    GET/PUT /api/admin/events read / save the list (login required)
  contact.js         POST /api/contact         sends the contact form by email
lib/                 shared code for the functions
```

## Settings Cloudflare needs

| Name | Type | Value |
|---|---|---|
| `EVENTS` | KV namespace binding | a KV namespace, e.g. `ive-events` |
| `ACCESS_TEAM_DOMAIN` | variable | e.g. `ive.cloudflareaccess.com` |
| `ACCESS_AUD` | variable | Application Audience (AUD) tag of the Access app |
| `RESEND_API_KEY` | secret | API key from resend.com |
| `CONTACT_TO` | variable | inbox for contact-form messages |
| `CONTACT_FROM` | variable, optional | e.g. `Ive website <website@yourdomain.com>` once the domain is verified in Resend |

Pages build settings: framework preset **None**, build command **empty**, build output directory **`public`**.

## Editing events

Go to `https://<site>/admin`, log in with the one-time code Cloudflare emails you,
edit, then press **Save & publish**. Past concerts move to "Recently" by themselves.

## Before going live

- Fill in the yellow-highlighted placeholders in `terms.html`, `privacy.html`, `cookies.html`
  and the KvK number in the footer of every page.
- Replace the fictional ticket links, social links and fees.
