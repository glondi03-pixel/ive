/* IVE — website editor: concerts, fees and contact details.
   Each part is loaded from its own API, edited in the browser and saved
   with the one "Save & publish" button (only the parts that changed). */

(function () {

    var ONLINE = /^https?:$/.test(location.protocol);
    var IMAGES = [
        'piano-open.jpg', 'playing.jpg', 'reflection.jpg', 'portrait-piano.jpg', 'profile-piano.jpg',
        'lid-lean.jpg', 'mirror.jpg', 'backstage.jpg', 'portrait-wall.jpg'
    ];
    var TEXT_FIELDS = ['date', 'city', 'title', 'venue', 'time', 'doors', 'description', 'price', 'access', 'status',
        'title_en', 'venue_en', 'description_en', 'price_en', 'access_en', 'status_en'];
    var CONTACT_FIELDS = ['email', 'phone', 'address', 'kvk', 'btw'];
    // in this order they fill two lines per fee: names, length, price / notes, English price
    var FEE_FIELDS = [
        ['name', 'Name (Dutch)', 80, 'Wekelijkse les', true], ['name_en', 'Name (English)', 80, 'Weekly lesson'],
        ['length', 'Length', 40, '45 min'], ['price', 'Price', 40, '€ 48', true],
        ['note', 'Note (Dutch)', 200, 'Beginners, kinderen, herintreders.'], ['note_en', 'Note (English)', 200, 'Beginners, children, returning players.'],
        ['price_en', 'Price in English', 40, 'only if different']
    ];

    var events = [];
    var site = null;        // { contact: {…}, fees: [ … ] }
    var current = null;     // the event being edited
    var dirty = { events: false, site: false };
    var loaded = { events: false, site: false };
    var saving = false;

    var $ = function (id) { return document.getElementById(id); };
    var form = $('editor');
    var contactForm = $('contact-form');
    var state = $('state');
    var saveBtn = $('save');

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function today() {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());
    }

    function setState(msg, cls) {
        state.textContent = msg;
        state.className = cls || '';
    }

    function markDirty(part) {
        dirty[part] = true;
        saveBtn.disabled = false;
        setState('Unsaved changes', 'dirty');
        updateDots();
    }

    function updateDots() {
        $('tab-events').querySelector('.dot').hidden = !dirty.events;
        $('tab-fees').querySelector('.dot').hidden = !dirty.site;
        $('tab-contact').querySelector('.dot').hidden = !dirty.site;
    }

    function banner(msg) {
        var b = $('banner');
        b.textContent = msg;
        b.hidden = !msg;
    }

    /* --- tabs ----------------------------------------------------------- */

    var TABS = ['events', 'fees', 'contact'];

    function showTab(name) {
        TABS.forEach(function (t) {
            $('tab-' + t).setAttribute('aria-selected', t === name ? 'true' : 'false');
            $('panel-' + t).hidden = t !== name;
        });
        try { sessionStorage.setItem('adm-tab', name); } catch (e) { /* private mode */ }
    }

    TABS.forEach(function (t) {
        $('tab-' + t).addEventListener('click', function () { showTab(t); });
    });

    var savedTab = null;
    try { savedTab = sessionStorage.getItem('adm-tab'); } catch (e) { /* private mode */ }
    if (location.hash && TABS.indexOf(location.hash.slice(1)) !== -1) savedTab = location.hash.slice(1);
    showTab(TABS.indexOf(savedTab) !== -1 ? savedTab : 'events');

    /* --- concerts: list -------------------------------------------------- */

    function sorted() {
        return events.slice().sort(function (a, b) {
            return ((a.date || '') + (a.time || '')).localeCompare((b.date || '') + (b.time || ''));
        });
    }

    function item(e, past) {
        var d = e.date ? e.date.split('-').reverse().join('.') : 'no date';
        return '<li><button type="button" class="adm-item' + (past ? ' past' : '') + '" data-i="' + events.indexOf(e) + '"' +
            (e === current ? ' aria-current="true"' : '') + '>' +
            '<span class="d">' + esc(d) + '</span>' +
            '<span class="t">' + esc((e.title || 'Untitled').replace(/\*/g, '')) + '<small>' + esc([e.venue, e.city].filter(Boolean).join(', ')) + '</small></span>' +
            '</button></li>';
    }

    function renderList() {
        var t = today();
        var all = sorted();
        var up = all.filter(function (e) { return !e.date || e.date >= t; });
        var past = all.filter(function (e) { return e.date && e.date < t; }).reverse();
        $('lists').innerHTML =
            '<div class="adm-group"><p class="label">Upcoming (' + up.length + ')</p>' +
                (up.length ? '<ul>' + up.map(function (e) { return item(e, false); }).join('') + '</ul>' : '<p class="adm-none">No upcoming concerts.</p>') +
            '</div>' +
            '<div class="adm-group"><p class="label">Past (' + past.length + ')</p>' +
                (past.length ? '<ul>' + past.map(function (e) { return item(e, true); }).join('') + '</ul>' : '<p class="adm-none">None yet.</p>') +
            '</div>';
    }

    $('lists').addEventListener('click', function (ev) {
        var b = ev.target.closest('.adm-item');
        if (b) select(events[+b.dataset.i]);
    });

    /* --- concerts: editor ------------------------------------------------ */

    function select(e) {
        current = e;
        $('empty').hidden = !!e;
        form.hidden = !e;
        renderList();
        if (!e) return;

        TEXT_FIELDS.forEach(function (k) { form.elements[k].value = e[k] || ''; });
        form.elements.durationMin.value = e.durationMin || '';
        form.elements.linkLabel.value = e.link ? e.link.label || '' : '';
        form.elements.linkLabel_en.value = e.link ? e.link.label_en || '' : '';
        form.elements.linkUrl.value = e.link ? e.link.url || '' : '';
        form.querySelector('.adm-en').open = TEXT_FIELDS.some(function (k) { return /_en$/.test(k) && e[k]; });
        form.querySelectorAll('.invalid').forEach(function (el) { el.classList.remove('invalid'); });
        $('ed-kind').textContent = e.date && e.date < today() ? 'Past concert' : 'Upcoming concert';
        renderProgramme();
        renderPhotos();
        if (window.matchMedia('(min-width: 861px)').matches) form.elements.date.focus({ preventScroll: true });
        else form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    form.addEventListener('input', function (ev) {
        if (!current) return;
        var el = ev.target, k = el.name;
        if (TEXT_FIELDS.indexOf(k) !== -1) {
            if (el.value) current[k] = el.value; else delete current[k];
        } else if (k === 'durationMin') {
            if (el.value) current.durationMin = Number(el.value); else delete current.durationMin;
        } else if (k === 'linkLabel' || k === 'linkLabel_en' || k === 'linkUrl') {
            var label = form.elements.linkLabel.value.trim(), labelEn = form.elements.linkLabel_en.value.trim(), url = form.elements.linkUrl.value.trim();
            if (label || url) {
                current.link = { label: label, url: url };
                if (labelEn) current.link.label_en = labelEn;
            } else delete current.link;
        } else if (k === 'image') {
            if (el.value) current.image = el.value; else delete current.image;
        } else if (el.dataset.p) {
            var row = current.programme[+el.dataset.row];
            row[el.dataset.p] = el.value;
        }
        el.classList.remove('invalid');
        markDirty('events');
        if (k === 'date' || k === 'title' || k === 'venue' || k === 'city') renderList();
    });

    /* programme rows */
    function renderProgramme() {
        var rows = current.programme || [];
        $('prog').innerHTML = rows.map(function (p, i) {
            return '<div class="row">' +
                '<label><span>Composer</span><input type="text" maxlength="120" data-p="composer" data-row="' + i + '" value="' + esc(p.composer) + '"></label>' +
                '<label><span>Work</span><input type="text" maxlength="200" data-p="work" data-row="' + i + '" value="' + esc(p.work) + '"></label>' +
                '<label><span>Length</span><input type="text" maxlength="20" data-p="duration" data-row="' + i + '" value="' + esc(p.duration) + '" placeholder="20′"></label>' +
                '<button type="button" class="adm-x" data-del="' + i + '" aria-label="Remove this piece">&times;</button>' +
            '</div>';
        }).join('');
    }

    $('prog-add').addEventListener('click', function () {
        current.programme = current.programme || [];
        current.programme.push({ composer: '', work: '', duration: '' });
        renderProgramme();
        markDirty('events');
        var inputs = $('prog').querySelectorAll('input[data-p="composer"]');
        inputs[inputs.length - 1].focus();
    });

    $('prog').addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-del]');
        if (!b) return;
        current.programme.splice(+b.dataset.del, 1);
        if (!current.programme.length) delete current.programme;
        renderProgramme();
        markDirty('events');
    });

    /* photo picker */
    function renderPhotos() {
        var opts = [''].concat(IMAGES);
        $('photos').innerHTML = opts.map(function (f) {
            return '<label><input type="radio" name="image" value="' + f + '"' + ((current.image || '') === f ? ' checked' : '') + '>' +
                '<span>' + (f ? '<img src="/images/' + f + '" alt="' + f + '" loading="lazy">' : 'Automatic') + '</span></label>';
        }).join('');
    }

    /* new / delete */
    $('new').addEventListener('click', function () {
        var e = { date: '', title: '', city: 'Maastricht' };
        events.push(e);
        select(e);
        markDirty('events');
    });

    $('delete').addEventListener('click', function () {
        if (!current) return;
        var name = (current.title || 'this concert').replace(/\*/g, '');
        if (!confirm('Delete "' + name + '"? It disappears from the website after you save.')) return;
        events.splice(events.indexOf(current), 1);
        select(null);
        markDirty('events');
    });

    /* --- fees ------------------------------------------------------------ */

    function renderFees() {
        var n = site.fees.length;
        $('fee-list').innerHTML = n ? site.fees.map(function (f, i) {
            return '<div class="adm-fee" data-fee="' + i + '">' +
                '<div class="adm-head full">' +
                    '<p class="label"><span class="n">' + String(i + 1).padStart(2, '0') + '</span>' + esc(f.name || 'New row') + '</p>' +
                    '<span class="adm-tools">' +
                        '<button type="button" class="adm-mini" data-move="-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move up">&uarr;</button>' +
                        '<button type="button" class="adm-mini" data-move="1"' + (i === n - 1 ? ' disabled' : '') + ' aria-label="Move down">&darr;</button>' +
                        '<button type="button" class="adm-delete" data-remove>Remove</button>' +
                    '</span>' +
                '</div>' +
                FEE_FIELDS.map(function (d) {
                    return '<label><span>' + d[1] + (d[4] ? ' <span class="req">*</span>' : '') + '</span>' +
                        '<input type="text" data-f="' + d[0] + '" maxlength="' + d[2] + '" placeholder="' + esc(d[3]) + '" value="' + esc(f[d[0]]) + '"' + (d[4] ? ' required' : '') + '></label>';
                }).join('') +
            '</div>';
        }).join('') : '<p class="adm-none">No rows — the fees table on the site will be empty.</p>';
    }

    $('fee-list').addEventListener('input', function (ev) {
        var el = ev.target, card = el.closest('[data-fee]');
        if (!card || !el.dataset.f) return;
        var f = site.fees[+card.dataset.fee];
        if (el.value) f[el.dataset.f] = el.value; else delete f[el.dataset.f];
        if (el.dataset.f === 'name') card.querySelector('.adm-head .label').lastChild.textContent = el.value || 'New row';
        el.classList.remove('invalid');
        markDirty('site');
    });

    $('fee-list').addEventListener('click', function (ev) {
        var card = ev.target.closest('[data-fee]');
        if (!card) return;
        var i = +card.dataset.fee;
        var move = ev.target.closest('[data-move]');
        if (move) {
            var j = i + +move.dataset.move;
            var row = site.fees.splice(i, 1)[0];
            site.fees.splice(j, 0, row);
            renderFees();
            $('fee-list').querySelector('[data-fee="' + j + '"] [data-move="' + move.dataset.move + '"]:not([disabled])')?.focus();
            markDirty('site');
        } else if (ev.target.closest('[data-remove]')) {
            if (!confirm('Remove "' + (site.fees[i].name || 'this row') + '" from the fees table?')) return;
            site.fees.splice(i, 1);
            renderFees();
            markDirty('site');
        }
    });

    $('fee-add').addEventListener('click', function () {
        if (!site) return;
        site.fees.push({ name: '', price: '' });
        renderFees();
        markDirty('site');
        var inputs = $('fee-list').querySelectorAll('input[data-f="name"]');
        inputs[inputs.length - 1].focus();
    });

    /* --- contact details ------------------------------------------------- */

    function renderContact() {
        CONTACT_FIELDS.forEach(function (k) { contactForm.elements[k].value = site.contact[k] || ''; });
    }

    contactForm.addEventListener('input', function (ev) {
        var el = ev.target;
        if (CONTACT_FIELDS.indexOf(el.name) === -1) return;
        site.contact[el.name] = el.value;
        el.classList.remove('invalid');
        markDirty('site');
    });

    contactForm.addEventListener('submit', function (ev) { ev.preventDefault(); });

    /* --- save ------------------------------------------------------------ */

    function eventProblem() {
        for (var i = 0; i < events.length; i++) {
            var e = events[i];
            var missing = ['date', 'title', 'city'].filter(function (k) { return !(e[k] || '').trim(); });
            if (missing.length) return { e: e, fields: missing };
        }
        return null;
    }

    function siteProblem() {
        var bad = CONTACT_FIELDS.filter(function (k) { return !contactForm.elements[k].checkValidity() || !(site.contact[k] || '').trim(); });
        if (bad.length) {
            showTab('contact');
            bad.forEach(function (k) { contactForm.elements[k].classList.add('invalid'); });
            contactForm.elements[bad[0]].focus();
            return 'Check the highlighted contact details before saving.';
        }
        var empty = $('fee-list').querySelectorAll('input[required]');
        for (var i = 0; i < empty.length; i++) {
            if (!empty[i].value.trim()) {
                showTab('fees');
                empty[i].classList.add('invalid');
                empty[i].focus();
                return 'Every fee needs at least a Dutch name and a price.';
            }
        }
        return null;
    }

    function send(url, body) {
        return fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (res) {
                if (!res.ok) throw new Error(res.j.error || 'Saving failed.');
                return res.j;
            });
    }

    function stamp(iso) {
        return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }

    saveBtn.addEventListener('click', function () {
        if (saving) return;

        if (dirty.events) {
            var problem = eventProblem();
            if (problem) {
                showTab('events');
                select(problem.e);
                problem.fields.forEach(function (k) { form.elements[k].classList.add('invalid'); });
                form.elements[problem.fields[0]].focus();
                setState('Fill in the date, title and city of every concert before saving.', 'err');
                return;
            }
        }
        if (dirty.site) {
            var msg = siteProblem();
            if (msg) { setState(msg, 'err'); return; }
        }
        if (!ONLINE) {
            setState('This is a local preview — saving only works on the live website.', 'err');
            return;
        }

        saving = true;
        saveBtn.disabled = true;
        setState('Saving…');
        var keep = current ? (current.date || '') + '|' + (current.title || '') : null;
        var jobs = [];

        if (dirty.events) {
            jobs.push(send('/api/admin/events', { events: events }).then(function (j) {
                events = j.events;
                dirty.events = false;
                var again = keep && events.filter(function (e) { return (e.date || '') + '|' + (e.title || '') === keep; })[0];
                select(again || null);
                return j.updatedAt;
            }));
        }
        if (dirty.site) {
            jobs.push(send('/api/admin/site', { contact: site.contact, fees: site.fees }).then(function (j) {
                site = { contact: j.contact, fees: j.fees };
                dirty.site = false;
                renderFees();
                renderContact();
                return j.updatedAt;
            }));
        }

        Promise.all(jobs)
            .then(function (times) {
                setState('Saved and published · ' + stamp(times[times.length - 1]) + ' — the website shows it within a minute.');
            })
            .catch(function (err) {
                saveBtn.disabled = false;
                setState(err.message || 'Saving failed. Check your connection and try again.', 'err');
            })
            .then(function () { saving = false; updateDots(); });
    });

    window.addEventListener('beforeunload', function (ev) {
        if (dirty.events || dirty.site) { ev.preventDefault(); ev.returnValue = ''; }
    });

    /* --- load ------------------------------------------------------------ */

    function get(url) {
        return fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (res) {
                if (!res.ok) throw new Error(res.j.error || 'Could not load ' + url);
                return res.j;
            });
    }

    function seedEvents() {
        events = JSON.parse(JSON.stringify(window.IVE_EVENTS || []));
    }

    function ready() {
        if (!loaded.events || !loaded.site) return;
        setState(state.dataset.note || 'Ready');
    }

    if (!ONLINE) {
        banner('Local preview: you can look around here, but loading the fees and saving only work on the live website.');
        seedEvents();
        renderList();
        site = { contact: {}, fees: [] };
        renderFees();
        setState('Preview mode');
        return;
    }

    get('/api/admin/events')
        .then(function (j) {
            if (j.events) {
                events = j.events;
                if (j.updatedAt) state.dataset.note = 'Last saved ' + new Date(j.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
            } else {
                seedEvents();
                state.dataset.note = 'Showing the starter concerts — nothing has been saved yet.';
            }
            renderList();
            loaded.events = true;
            ready();
        })
        .catch(function (err) {
            banner(err.message);
            setState('Could not load the concerts', 'err');
        });

    get('/api/admin/site')
        .then(function (j) {
            site = { contact: j.contact, fees: j.fees };
            renderFees();
            renderContact();
            loaded.site = true;
            ready();
        })
        .catch(function (err) {
            banner(err.message);
            setState('Could not load the fees and contact details', 'err');
        });

})();
