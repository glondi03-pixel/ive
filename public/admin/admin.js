/* IVE — events editor. Loads the list, edits it in the browser, saves it in one go. */

(function () {

    var API = '/api/admin/events';
    var ONLINE = /^https?:$/.test(location.protocol);
    var IMAGES = [
        'piano-open.jpg', 'playing.jpg', 'reflection.jpg', 'portrait-piano.jpg', 'profile-piano.jpg',
        'lid-lean.jpg', 'mirror.jpg', 'backstage.jpg', 'portrait-wall.jpg', 'headshot.jpg'
    ];
    var TEXT_FIELDS = ['date', 'city', 'title', 'venue', 'time', 'doors', 'description', 'price', 'access', 'status'];

    var events = [];
    var current = null;     // the event object being edited
    var dirty = false;
    var saving = false;

    var $ = function (id) { return document.getElementById(id); };
    var form = $('editor');
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

    function markDirty() {
        dirty = true;
        saveBtn.disabled = false;
        setState('Unsaved changes', 'dirty');
    }

    function banner(msg) {
        var b = $('banner');
        b.textContent = msg;
        b.hidden = !msg;
    }

    /* --- list ----------------------------------------------------------- */

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
                (up.length ? '<ul>' + up.map(function (e) { return item(e, false); }).join('') + '</ul>' : '<p class="adm-none">No upcoming events.</p>') +
            '</div>' +
            '<div class="adm-group"><p class="label">Past (' + past.length + ')</p>' +
                (past.length ? '<ul>' + past.map(function (e) { return item(e, true); }).join('') + '</ul>' : '<p class="adm-none">None yet.</p>') +
            '</div>';
    }

    $('lists').addEventListener('click', function (ev) {
        var b = ev.target.closest('.adm-item');
        if (b) select(events[+b.dataset.i]);
    });

    /* --- editor --------------------------------------------------------- */

    function select(e) {
        current = e;
        $('empty').hidden = !!e;
        form.hidden = !e;
        renderList();
        if (!e) return;

        TEXT_FIELDS.forEach(function (k) { form.elements[k].value = e[k] || ''; });
        form.elements.durationMin.value = e.durationMin || '';
        form.elements.linkLabel.value = e.link ? e.link.label || '' : '';
        form.elements.linkUrl.value = e.link ? e.link.url || '' : '';
        form.querySelectorAll('.invalid').forEach(function (el) { el.classList.remove('invalid'); });
        $('ed-kind').textContent = e.date && e.date < today() ? 'Past event' : 'Upcoming event';
        renderProgramme();
        renderPhotos();
        form.elements.date.focus({ preventScroll: true });
    }

    form.addEventListener('input', function (ev) {
        if (!current) return;
        var el = ev.target, k = el.name;
        if (TEXT_FIELDS.indexOf(k) !== -1) {
            if (el.value) current[k] = el.value; else delete current[k];
        } else if (k === 'durationMin') {
            if (el.value) current.durationMin = Number(el.value); else delete current.durationMin;
        } else if (k === 'linkLabel' || k === 'linkUrl') {
            var label = form.elements.linkLabel.value.trim(), url = form.elements.linkUrl.value.trim();
            if (label || url) current.link = { label: label, url: url }; else delete current.link;
        } else if (k === 'image') {
            if (el.value) current.image = el.value; else delete current.image;
        } else if (el.dataset.p) {
            var row = current.programme[+el.dataset.row];
            row[el.dataset.p] = el.value;
        }
        el.classList.remove('invalid');
        markDirty();
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
        markDirty();
        var inputs = $('prog').querySelectorAll('input[data-p="composer"]');
        inputs[inputs.length - 1].focus();
    });

    $('prog').addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-del]');
        if (!b) return;
        current.programme.splice(+b.dataset.del, 1);
        if (!current.programme.length) delete current.programme;
        renderProgramme();
        markDirty();
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
        var e = { date: '', title: '', city: '' };
        events.push(e);
        select(e);
        markDirty();
    });

    $('delete').addEventListener('click', function () {
        if (!current) return;
        var name = (current.title || 'this event').replace(/\*/g, '');
        if (!confirm('Delete "' + name + '"? It disappears from the website after you save.')) return;
        events.splice(events.indexOf(current), 1);
        select(null);
        markDirty();
    });

    /* --- save ----------------------------------------------------------- */

    function firstProblem() {
        for (var i = 0; i < events.length; i++) {
            var e = events[i];
            var missing = ['date', 'title', 'city'].filter(function (k) { return !(e[k] || '').trim(); });
            if (missing.length) return { e: e, fields: missing };
        }
        return null;
    }

    saveBtn.addEventListener('click', function () {
        if (saving) return;
        var problem = firstProblem();
        if (problem) {
            select(problem.e);
            problem.fields.forEach(function (k) { form.elements[k].classList.add('invalid'); });
            form.elements[problem.fields[0]].focus();
            setState('Fill in the date, title and city of every event before saving.', 'err');
            return;
        }
        if (!ONLINE) {
            setState('This is a local preview — saving only works on the live website.', 'err');
            return;
        }

        saving = true;
        saveBtn.disabled = true;
        setState('Saving…');
        var keep = current ? (current.date || '') + '|' + (current.title || '') : null;

        fetch(API, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events: events })
        })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (res) {
                if (!res.ok) throw new Error(res.j.error || 'Saving failed.');
                events = res.j.events;
                dirty = false;
                var again = keep && events.filter(function (e) { return (e.date || '') + '|' + (e.title || '') === keep; })[0];
                select(again || null);
                setState('Saved and published · ' + new Date(res.j.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
            })
            .catch(function (err) {
                saveBtn.disabled = false;
                setState(err.message || 'Saving failed. Check your connection and try again.', 'err');
            })
            .then(function () { saving = false; });
    });

    window.addEventListener('beforeunload', function (ev) {
        if (dirty) { ev.preventDefault(); ev.returnValue = ''; }
    });

    /* --- load ----------------------------------------------------------- */

    function useSeed(note) {
        events = JSON.parse(JSON.stringify(window.IVE_EVENTS || []));
        renderList();
        setState(note);
    }

    if (!ONLINE) {
        banner('Local preview: you can try the editor here, but saving only works on the live website.');
        useSeed('Preview mode');
        return;
    }

    fetch(API, { headers: { Accept: 'application/json' }, cache: 'no-store' })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
            if (!res.ok) throw new Error(res.j.error || 'Could not load the events.');
            if (res.j.events) {
                events = res.j.events;
                renderList();
                setState(res.j.updatedAt
                    ? 'Last saved ' + new Date(res.j.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
                    : 'Ready');
            } else {
                useSeed('Showing the starter list — nothing has been saved yet.');
            }
        })
        .catch(function (err) {
            banner(err.message);
            setState('Could not load the events', 'err');
        });

})();
