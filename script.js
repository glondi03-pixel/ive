/* IVE — small progressive enhancements, no dependencies */

(function () {

    // folder that holds script.js — the site root, also from pages under /en/
    var ROOT = document.currentScript ? document.currentScript.src.replace(/script\.js(\?.*)?$/, '') : '';

    var ONLINE = false;   // GitHub Pages preview: no server, so events come from data/events.js and the form is a demo
    var PHONE = window.matchMedia('(max-width: 699px)');

    /* --- Language: Dutch is the main language, English lives under /en/ --- */

    var EN = document.documentElement.lang === 'en';
    var L = EN ? {
        locale: 'en-GB', next: 'Next on stage', all: 'All dates', badge: 'Next concert',
        venue: 'Venue', tickets: 'Tickets', duration: 'Duration', access: 'Access', doors: 'doors',
        add: 'Add to calendar', cal: 'Calendar', one: '1 date', many: ' dates'
    } : {
        locale: 'nl-NL', next: 'Binnenkort op het podium', all: 'Alle data', badge: 'Volgend concert',
        venue: 'Locatie', tickets: 'Kaarten', duration: 'Duur', access: 'Toegankelijkheid', doors: 'deuren open',
        add: 'Zet in agenda', cal: 'Agenda', one: '1 datum', many: ' data'
    };

    // events may carry English versions of their texts as title_en, description_en, …
    function localise(list) {
        if (!EN) return list;
        return list.map(function (e) {
            var c = Object.assign({}, e);
            ['title', 'description', 'status', 'price', 'access', 'venue'].forEach(function (k) {
                if (e[k + '_en']) c[k] = e[k + '_en'];
            });
            if (e.link && e.link.label_en) c.link = { label: e.link.label_en, url: e.link.url };
            return c;
        });
    }

    /* --- Phone menu ------------------------------------------------------ */

    var bar = document.querySelector('.bar.has-menu');
    var menuBtn = bar && bar.querySelector('.menu-btn');

    function setMenu(open) {
        bar.classList.toggle('menu-open', open);
        document.body.classList.toggle('menu-lock', open);
        menuBtn.setAttribute('aria-expanded', open);
        menuBtn.firstChild.textContent = open ? menuBtn.dataset.close : menuBtn.dataset.open;
    }

    if (menuBtn) {
        menuBtn.addEventListener('click', function () { setMenu(!bar.classList.contains('menu-open')); });
        bar.querySelector('nav').addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
        PHONE.addEventListener('change', function () { setMenu(false); });
    }

    /* --- Sections that fold on phones (FAQ, legal contents) -------------- */

    function syncDetails() {
        document.querySelectorAll('details[data-auto]').forEach(function (d) { d.open = !PHONE.matches; });
    }
    syncDetails();
    PHONE.addEventListener('change', syncDetails);

    /* --- Tables become stacked cards on phones: label each cell ----------- */

    document.querySelectorAll('.tbl').forEach(function (t) {
        var heads = [].map.call(t.querySelectorAll('thead th'), function (th) { return th.textContent; });
        t.querySelectorAll('tbody tr').forEach(function (tr) {
            [].forEach.call(tr.children, function (td, i) { td.setAttribute('data-label', heads[i] || ''); });
        });
    });

    /* --- Phone booking bar: shows after the hero, hides near the end ------ */

    var cta = document.querySelector('.m-cta');
    if (cta) {
        document.body.classList.add('has-cta');
        var endZone = document.querySelector('#contact, #fees, footer');
        function update() {
            var nearEnd = endZone && endZone.getBoundingClientRect().top < window.innerHeight;
            cta.classList.toggle('show', window.scrollY > 520 && !nearEnd);
        }
        window.addEventListener('scroll', update, { passive: true });
        update();
    }

    /* --- Events ----------------------------------------------------------
       Live site: events come from /api/events (edited by Ive at /admin).
       If the API has nothing yet, or the page is opened as a local file,
       the starter list in data/events.js (window.IVE_EVENTS) is used.
    ------------------------------------------------------------------------ */

    var upcoming = [];

    function loadEvents() {
        var seed = window.IVE_EVENTS || [];
        if (!ONLINE) return Promise.resolve(seed);
        return fetch('/api/events', { headers: { Accept: 'application/json' } })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (j) { return j && Array.isArray(j.events) ? j.events : seed; })
            .catch(function () { return seed; });
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // escaped text, with *word* turned into italics
    function rich(s) { return esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>'); }

    function safeUrl(u) { return /^(https?:\/\/|mailto:|tel:|\/|#|[\w-]+\.html)/i.test(u || '') ? u : '#'; }

    function parts(e) {
        var d = new Date(e.date + 'T12:00:00');
        var f = function (o) { return d.toLocaleDateString(L.locale, o); };
        return {
            day: f({ day: '2-digit' }),
            weekday: f({ weekday: 'long' }),
            wd: f({ weekday: 'short' }),
            month: f({ month: 'long' }),
            mon: f({ month: 'short' }),
            year: f({ year: 'numeric' }),
            numeric: e.date.split('-').reverse().join('.')
        };
    }

    function place(e) { return [e.venue, e.city].filter(Boolean).join(', '); }

    var FALLBACK_IMAGES = ['portrait-piano.jpg', 'reflection.jpg', 'playing.jpg', 'piano-open.jpg'];

    function img(e, i) { return ROOT + 'images/' + encodeURIComponent(e.image || FALLBACK_IMAGES[i % FALLBACK_IMAGES.length]); }

    function render(all) {
        var sorted = all.slice().sort(function (a, b) {
            return (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''));
        });

        // "today" in Dutch time, as YYYY-MM-DD; an event stays upcoming for the whole of its day
        var today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());
        upcoming = sorted.filter(function (e) { return e.date >= today; });
        var past = sorted.filter(function (e) { return e.date < today; }).reverse().slice(0, 6);

        /* "Next on stage" band — home page */
        var band = document.getElementById('next-band');
        if (band && upcoming.length) {
            var n = upcoming[0], p = parts(n);
            band.innerHTML =
                '<span class="label">' + L.next + '</span>' +
                '<span class="nb-title">' + esc(p.wd) + ' ' + esc(+p.day) + ' ' + esc(p.month) + ' &middot; ' + rich(n.title) + '</span>' +
                '<span class="nb-meta">' + esc(place(n)) + (n.time ? ' &middot; ' + esc(n.time) : '') + '</span>' +
                '<span class="nb-go">' + L.all + ' &rarr;</span>';
            band.hidden = false;
        }

        /* Featured next concert — events page */
        var feat = document.getElementById('ev-featured');
        if (feat && upcoming.length) {
            var e = upcoming[0], q = parts(e);
            var prog = (e.programme || []).map(function (x) {
                return '<li><span><span class="composer">' + esc(x.composer) + '</span> — ' + rich(x.work) + '</span><span>' + esc(x.duration) + '</span></li>';
            }).join('');
            var meta = [[L.venue, place(e)], [L.tickets, e.price], [L.duration, e.durationMin ? e.durationMin + ' min' : ''], [L.access, e.access]]
                .filter(function (m) { return m[1]; })
                .map(function (m) { return '<div><dt>' + m[0] + '</dt><dd>' + esc(m[1]) + '</dd></div>'; }).join('');
            feat.innerHTML =
                '<figure><span class="badge">' + L.badge + '</span><img src="' + img(e, 3) + '" alt=""></figure>' +
                '<div class="feat-body">' +
                    '<div class="datebig"><span class="d">' + esc(q.day) + '</span><span class="m"><b>' + esc(q.weekday) + '</b>' +
                        esc(q.month) + ' ' + esc(q.year) +
                        (e.time ? '<br>' + esc(e.time) + (e.doors ? ' — ' + L.doors + ' ' + esc(e.doors) : '') : '') + '</span></div>' +
                    '<h2>' + rich(e.title) + '</h2>' +
                    (e.description ? '<p>' + rich(e.description) + '</p>' : '') +
                    (prog ? '<ol class="programme">' + prog + '</ol>' : '') +
                    (meta ? '<dl class="feat-meta">' + meta + '</dl>' : '') +
                    '<div class="actions">' +
                        (e.link ? '<a href="' + esc(safeUrl(e.link.url)) + '" class="btn">' + esc(e.link.label) + '</a>' : '') +
                        (e.time ? '<button type="button" class="btn ghost" data-ics="0">' + L.add + '</button>' : '') +
                    '</div>' +
                '</div>';
            feat.hidden = false;
        }

        /* Upcoming list */
        var list = document.getElementById('ev-upcoming');
        if (list) {
            list.innerHTML = upcoming.map(function (e, i) {
                var p = parts(e);
                var action = e.link
                    ? '<a href="' + esc(safeUrl(e.link.url)) + '" class="link-arrow">' + esc(e.link.label) + '</a>'
                    : (e.time ? '<button type="button" class="link-arrow as-btn" data-ics="' + i + '">' + L.cal + '</button>' : '');
                return '<li class="ev">' +
                    '<div class="ev-date"><span class="d">' + esc(p.day) + '</span><span class="m">' + esc(p.mon) + ' ' + esc(p.year) + '<span class="wd">' + esc(p.wd) + '</span></span></div>' +
                    '<span class="thumb"><img src="' + img(e, i) + '" alt=""></span>' +
                    '<div><h3>' + rich(e.title) + '</h3>' + (e.description ? '<p>' + rich(e.description) + '</p>' : '') + '</div>' +
                    '<div class="where">' + esc(e.venue || e.city) + '<span>' + esc(e.venue ? e.city : '') + (e.time ? ' &middot; ' + esc(e.time) : '') + '</span></div>' +
                    '<div class="act">' + (e.status ? '<span class="status">' + esc(e.status) + '</span>' : '') + action + '</div>' +
                '</li>';
            }).join('');

            var count = document.getElementById('ev-count');
            if (count) count.textContent = upcoming.length === 1 ? L.one : upcoming.length + L.many;
            document.getElementById('ev-empty').hidden = upcoming.length > 0;
        }

        /* Past list */
        var pastList = document.getElementById('ev-past');
        if (pastList) {
            pastList.innerHTML = past.map(function (e) {
                return '<li><span>' + esc(parts(e).numeric) + '</span><span>' + rich(e.title) + '</span><span>' + esc(e.city) + '</span></li>';
            }).join('');
            document.getElementById('ev-past-wrap').hidden = !past.length;
        }
    }

    if (document.getElementById('next-band') || document.getElementById('ev-upcoming')) {
        loadEvents().then(localise).then(render);
    }

    /* "Add to calendar" — .ics download in Dutch time */
    function stamp(date, time) { return date.replace(/-/g, '') + 'T' + time.replace(':', '') + '00'; }

    function endOf(e) {
        var d = new Date(e.date + 'T' + e.time + ':00Z');
        d.setUTCMinutes(d.getUTCMinutes() + (e.durationMin || 90));
        return d.toISOString().slice(0, 16).replace(/[-:]/g, '') + '00';
    }

    function icsText(s) { return String(s).replace(/\*/g, '').replace(/[\\;,]/g, '\\$&').replace(/\n/g, ' '); }

    document.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-ics]');
        if (!btn) return;
        var e = upcoming[+btn.dataset.ics];
        if (!e || !e.time) return;
        var ics = [
            'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ive//Concerts//EN',
            'BEGIN:VEVENT',
            'UID:' + e.date + '-' + e.time.replace(':', '') + '@ive-snijders.nl',
            'DTSTAMP:' + new Date().toISOString().replace(/[-:]|\.\d+/g, ''),
            'DTSTART;TZID=Europe/Amsterdam:' + stamp(e.date, e.time),
            'DTEND;TZID=Europe/Amsterdam:' + endOf(e),
            'SUMMARY:' + icsText('Ive — ' + e.title),
            'LOCATION:' + icsText(place(e)),
            'END:VEVENT', 'END:VCALENDAR'
        ].join('\r\n');
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
        a.download = 'ive-' + e.date + '.ics';
        a.click();
        URL.revokeObjectURL(a.href);
    });

    /* --- Contact form ------------------------------------------------ */

    var form = document.getElementById('inquiry');

    if (form) {
        var groups = form.querySelectorAll('.topic-fields');
        var errorLine = document.getElementById('form-error');
        var submit = form.querySelector('button[type="submit"]');

        function showTopic(value) {
            groups.forEach(function (g) { g.hidden = g.dataset.for !== value; });
        }

        form.querySelectorAll('input[name="topic"]').forEach(function (r) {
            r.addEventListener('change', function () { showTopic(r.value); });
        });

        // contact.html?topic=booking preselects the right tab
        var wanted = new URLSearchParams(location.search).get('topic');
        var preset = wanted && form.querySelector('input[name="topic"][value="' + wanted + '"]');
        if (preset) preset.checked = true;
        showTopic(form.querySelector('input[name="topic"]:checked').value);

        function done() {
            form.hidden = true;
            var sent = document.getElementById('sent');
            sent.hidden = false;
            sent.focus();
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            if (!ONLINE) { done(); return; }   // local preview: nothing to send to

            // send only the fields of the selected topic
            var data = {};
            new FormData(form).forEach(function (v, k) {
                var field = form.elements[k];
                var group = field && (field.closest ? field : field[0]).closest('.topic-fields');
                if (!group || !group.hidden) data[k] = v;
            });
            data.privacy = form.elements.privacy.checked;

            errorLine.hidden = true;
            submit.disabled = true;
            fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
                .then(function (r) { if (!r.ok) throw new Error(r.status); done(); })
                .catch(function () { errorLine.hidden = false; })
                .then(function () { submit.disabled = false; });
        });
    }

})();
