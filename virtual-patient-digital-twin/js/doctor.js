/*
 * doctor.js - care team dashboard: staff login, explainable triage list,
 *             patient one-page summary, advice approval, broadcast, audit,
 *             mock teleconsultation, certificates and demo admin actions.
 *
 * Demo for education only, not medical advice.
 */
(function () {
  'use strict';

  var session = null;
  var selectedId = null;
  var patients = [];
  var filters = { q: '', risk: 'all', cond: '', sort: 'risk', archived: false };

  function when(o) {
    if (!o) return '-';
    if (o.date) return App.fmtDate(o.date);
    if (o.timestamp) return App.fmtDate(o.timestamp);
    if (o.completionDate) return App.fmtDate(o.completionDate);
    if (typeof o.daysAgo === 'number') return App.fmtDate(DemoData.dateFromDaysAgo(o.daysAgo));
    if (typeof o.daysAhead === 'number') return App.fmtDate(DemoData.dateFromDaysAhead(o.daysAhead));
    return '-';
  }

  /* ------------------------------------------------- contact helpers */
  function defaultEmailFor(id) {
    return String(id || 'patient').toLowerCase().replace(/[^a-z0-9-]/g, '') + '@demo.local';
  }
  function contactEmail(p) {
    var e = (p && p.email ? String(p.email).trim() : '');
    return e || defaultEmailFor(p && p.id);
  }
  function contactPhone(p) { return (p && p.phone ? String(p.phone).trim() : ''); }
  function contactEmergency(p) { return (p && p.emergencyContact ? String(p.emergencyContact).trim() : ''); }
  function telHref(phone) {
    var raw = String(phone || '').trim();
    if (!raw) return '';
    var digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    // Preserve a single leading + for international numbers, drop any other + signs.
    var prefix = raw.charAt(0) === '+' ? '+' : '';
    return 'tel:' + prefix + digits;
  }
  function mailHref(email) {
    var ml = String(email || '').trim();
    if (!ml) return '';
    // Basic guard: never emit a broken mailto: link.
    if (ml.indexOf('@') === -1) return '';
    return 'mailto:' + ml;
  }
  function contactActionModal(kind, value, href) {
    var label = kind === 'email' ? 'Email' : kind === 'sms' ? 'Demo SMS' : 'Call';
    var body = document.createElement('div');
    var safeVal = String(value || '');
    var hint = kind === 'email'
      ? 'Opens your mail app via a mailto: link. Nothing is sent by this demo itself.'
      : kind === 'sms'
        ? 'Demo SMS is simulated in this browser — no real message is sent.'
        : 'On mobile this dials via a tel: link. On desktop (no phone handler) use Copy instead. This demo never auto-dials.';
    body.innerHTML =
      '<p class="small" style="word-break:break-all"><strong>' + App.esc(safeVal) + '</strong></p>' +
      '<p class="fineprint">' + App.esc(hint) + '</p>' +
      '<p class="fineprint mono">' + App.esc(href || '') + '</p>';
    var actions = [{ label: 'Close', value: false }];
    if (href) actions.push({ label: label + ' now', value: true, primary: true });
    App.modal({ title: (kind === 'email' ? '✉️ ' : kind === 'sms' ? '✉️ ' : '📞 ') + label + ' (demo)', bodyNode: body, actions: actions })
      .then(function (go) {
        if (go && href) { window.location.href = href; }
      });
  }
  function isValidPhone(v) {
    var d = String(v || '').replace(/\D/g, '');
    return d.length >= 7 && d.length <= 15;
  }
  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
  }
  function copyText(t, label) {
    function done() { App.toast((label || 'Value') + ' copied to clipboard (demo).', 'success'); }
    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = t;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done();
      } catch (e) { App.toast('Copy failed — select and copy manually.', 'error'); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(done, fallback);
    } else fallback();
  }

  function lab(p, key) {
    var l = p.labs && p.labs[key];
    if (!l) return null;
    var v = typeof l === 'object' ? l.value : l;
    if (v === undefined || v === null) return null;
    return { key: key, label: (l.label || key), value: v, unit: l.unit || '', range: l.range || '' };
  }

  function labText(p, key) {
    var l = lab(p, key);
    if (!l) return '—';
    return l.value + (l.unit ? ' ' + l.unit : '') + (l.range ? ' (ref ' + l.range + ')' : '');
  }

  function visiblePatients() {
    return patients.filter(function (p) {
      var st = p.status || 'active';
      if (filters.archived) return true;
      return st !== 'archived' && !p.archived;
    });
  }

  var HEALTHY_SET = ['healthy', 'stable', 'elderly wellness'];
  function matches(p) {
    if (filters.risk !== 'all' && Risk.assess(p, {}).level !== filters.risk) return false;
    if (filters.cond) {
      var hay = ((p.condition || '') + ' ' + (p.diagnosis || []).join(' ')).toLowerCase();
      if (filters.cond === 'healthy') {
        var condLower = String(p.condition || '').toLowerCase();
        if (HEALTHY_SET.indexOf(condLower) === -1) return false;
      } else if (hay.indexOf(filters.cond) === -1) return false;
    }
    if (filters.q) {
      var q = filters.q.toLowerCase();
      var r = Risk.assess(p, {});
      var sugBlob = suggestionsOf(p).map(function (s) { return s.text || ''; }).join(' ');
      var blob = [p.id, p.name, p.condition, (p.diagnosis || []).join(' '), r.level, r.levelLabel,
        p.phone || '', p.emergencyContact || '', p.email || '', sugBlob].join(' ').toLowerCase();
      if (blob.indexOf(q) === -1) return false;
    }
    return true;
  }

  function sorted(list) {
    var ord = { red: 0, yellow: 1, green: 2 };
    return list.slice().sort(function (a, b) {
      if (filters.sort === 'name') return String(a.name).localeCompare(String(b.name));
      if (filters.sort === 'id') return String(a.id).localeCompare(String(b.id));
      var d = ord[Risk.assess(a, {}).level] - ord[Risk.assess(b, {}).level];
      if (d) return d;
      return Risk.assess(b, {}).score - Risk.assess(a, {}).score;
    });
  }

  function renderStats(list) {
    var c = { red: 0, yellow: 0, green: 0 };
    list.forEach(function (p) { c[Risk.assess(p, {}).level]++; });
    document.getElementById('stTotal').textContent = list.length;
    document.getElementById('stRed').textContent = c.red;
    document.getElementById('stYellow').textContent = c.yellow;
    document.getElementById('stGreen').textContent = c.green;
    document.getElementById('boardSub').textContent =
      'Showing ' + list.length + ' patient(s) · 🔴 ' + c.red + ' · 🟡 ' + c.yellow + ' · 🟢 ' + c.green +
      ' — rule-based demo triage (RED → YELLOW → GREEN), not medically validated.';
  }

  function suggestionsOf(p) {
    return (p && p.suggestions && Array.isArray(p.suggestions)) ? p.suggestions : [];
  }

  function cardHTML(p) {
    var r = Risk.assess(p, {});
    var d = (p.wearableData || []).slice(-1)[0] || {};
    var cls = r.level === 'red' ? 'p-red' : r.level === 'yellow' ? 'p-yellow' : 'p-green';
    var ph = contactPhone(p) || '-';
    var em = contactEmail(p);
    var sugs = suggestionsOf(p);
    var lastSug = sugs.length ? sugs[sugs.length - 1] : null;
    return '<article class="patient-card ' + cls + '" data-card="' + App.esc(p.id) + '">' +
      '<div class="pc-head">' +
      '<div><div class="pc-name">' + App.esc(p.name) + '</div>' +
      '<div class="pc-id mono">' + App.esc(p.id) + ' · ' + App.esc(String(p.age)) + 'y · ' + App.esc(p.gender || '') +
      ((p.status === 'archived' || p.archived) ? ' · ARCHIVED' : '') + (p.deceased ? ' · DECEASED' : '') + '</div></div>' +
      '<div>' + App.riskBadge(r.level) + '</div></div>' +
      '<div class="pc-metrics">' +
      '<div class="pc-metric"><b>' + App.esc(String(d.bloodSugar || '—')) + '</b>glucose mg/dL</div>' +
      '<div class="pc-metric"><b>' + App.esc(String(d.systolicBP || '—')) + '/' + App.esc(String(d.diastolicBP || '—')) + '</b>BP mmHg</div>' +
      '<div class="pc-metric"><b>' + App.esc(String(d.spo2 || '—')) + '%</b>SpO2</div>' +
      '<div class="pc-metric"><b>' + App.esc(String(d.steps || '—')) + '</b>steps</div>' +
      '<div class="pc-metric"><b>' + App.esc(String((p.adherence || {}).percent || 0)) + '%</b>adherence</div>' +
      '<div class="pc-metric"><b>' + App.esc(String(r.score)) + '</b>demo risk score</div>' +
      '</div>' +
      '<div class="pc-reason">Main reason: ' + App.esc(r.reasons[0] || 'No demo rule breached') + '</div>' +
      '<div class="pc-reason">' + App.esc(p.condition || '') + ' · top domain: ' + App.esc(r.topDomainLabel || '') + '</div>' +
      '<div class="pc-reason small">📞 ' + (ph === '-'
        ? '<span class="muted">not recorded</span>'
        : '<a href="' + App.esc(telHref(ph)) + '" data-sim-call="' + App.esc(p.id) + '" data-call-value="' + App.esc(ph) + '">' + App.esc(ph) + '</a>') +
      ' · ✉️ <a href="' + App.esc(mailHref(em)) + '" data-sim-email="' + App.esc(p.id) + '" data-email-value="' + App.esc(em) + '">' + App.esc(em) + '</a></div>' +
      '<div class="suggest-box" data-suggest-box="' + App.esc(p.id) + '">' +
      '<label class="suggest-label" for="sug-' + App.esc(p.id) + '">💡 Suggestion <span class="suggest-count">' + sugs.length + '</span></label>' +
      (lastSug
        ? '<div class="suggest-last small">Latest: ' + App.esc(String(lastSug.text || '').slice(0, 90)) + (String(lastSug.text || '').length > 90 ? '…' : '') + '</div>'
        : '<div class="suggest-last small muted">No suggestions yet.</div>') +
      '<div class="suggest-row">' +
      '<input type="text" id="sug-' + App.esc(p.id) + '" data-suggest-input="' + App.esc(p.id) + '" placeholder="Write a suggestion for ' + App.esc(p.name) + '…" maxlength="280" aria-label="Suggestion for ' + App.esc(p.name) + '">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-suggest-save="' + App.esc(p.id) + '">Save</button>' +
      '</div></div>' +
      '<div class="btn-row">' +
      '<button type="button" class="btn btn-primary btn-sm" data-open="' + App.esc(p.id) + '">Open profile</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-contact="' + App.esc(p.id) + '">📞 Contact</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-goto-suggest="' + App.esc(p.id) + '">💡 Suggestions</button>' +
      '<a class="btn btn-ghost btn-sm" href="patient.html">Patient view</a>' +
      '</div></article>';
  }

  async function saveSuggestion(pid, text) {
    var p = await Storage.getPatient(pid);
    if (!p) { App.toast('Patient not found.', 'error'); return null; }
    var t = String(text || '').trim();
    if (!t) { App.toast('Type a suggestion first.', 'error'); return null; }
    p.suggestions = suggestionsOf(p);
    p.suggestions.push({
      id: 'SUG-' + Date.now(),
      text: t.slice(0, 1000),
      author: session ? (session.name + ' (' + session.id + ')') : 'care team',
      authorRole: session ? session.role : 'system',
      date: DemoData.dateFromDaysAgo(0)
    });
    await Storage.savePatient(p);
    await Storage.saveAuditLog({
      actorId: session ? session.id : 'system',
      actorRole: session ? session.role : 'system',
      action: 'suggestion.saved',
      patientId: pid,
      message: t.slice(0, 120)
    });
    return p;
  }

  /* Sequential IDs only: PT-1001, PT-1002, … — never random. */
  function patientNum(id) {
    var m = String(id || '').match(/^PT-(\d+)$/i);
    return m ? parseInt(m[1], 10) : 999999;
  }
  function nextPatientId(list) {
    var max = 1010;
    (list || []).forEach(function (x) {
      var n = patientNum(x && x.id);
      if (!isNaN(n) && n > max && n < 999999) max = n;
    });
    var seen = {};
    (list || []).forEach(function (x) { if (x && x.id) seen[String(x.id).toUpperCase()] = true; });
    var c = max + 1;
    while (seen['PT-' + c]) c++;
    return 'PT-' + c;
  }
  function renderDemoNumbers(all) {
    var host = document.getElementById('demoPatientList');
    if (!host) return;
    var seq = (all || []).filter(function (p) { return (p.status || 'active') !== 'archived' && !p.deceased; })
      .sort(function (a, b) { return patientNum(a.id) - patientNum(b.id); });
    host.innerHTML = '';
    if (!seq.length) { host.innerHTML = '<span class="muted small">No active demo patients.</span>'; return; }
    seq.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip mono';
      b.style.fontWeight = '700';
      b.textContent = p.id;
      b.title = (p.name || '') + ' · ' + (p.condition || '');
      b.setAttribute('aria-label', 'Open ' + p.id + ' ' + (p.name || ''));
      b.addEventListener('click', function () { openDetail(p.id); });
      host.appendChild(b);
    });
    var note = document.createElement('span');
    note.className = 'small muted';
    note.style.width = '100%';
    note.textContent = 'Numbers run sequentially ' + seq[0].id + ' → ' + seq[seq.length - 1].id + ' · next new patient gets ' + nextPatientId(all) + '.';
    host.appendChild(note);
  }

  async function renderBoard() {
    patients = await Storage.getAllPatients();
    var list = sorted(visiblePatients().filter(matches));
    renderStats(visiblePatients());
    renderDemoNumbers(patients);
    await renderCareTeam();
    var grid = document.getElementById('patientGrid');
    var empty = document.getElementById('gridEmpty');
    grid.innerHTML = list.map(cardHTML).join('');
    empty.hidden = !!list.length;
    grid.querySelectorAll('[data-open]').forEach(function (b) {
      b.addEventListener('click', function () { openDetail(b.getAttribute('data-open')); });
    });
    grid.querySelectorAll('[data-contact]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var pid = b.getAttribute('data-contact');
        b.disabled = true;
        try {
          await openDetail(pid);
          var c = document.getElementById('contactCard');
          if (c) {
            c.scrollIntoView({ behavior: 'smooth', block: 'start' });
            var first = document.getElementById('cPhoneIn');
            if (first) first.focus({ preventScroll: true });
          } else {
            App.toast('Contact section is not available for ' + pid + '.', 'error');
          }
        } catch (e) {
          App.toast('Could not open contact for ' + pid + ': ' + (e && e.message ? e.message : 'unknown error'), 'error');
        } finally {
          b.disabled = false;
        }
      });
    });
    grid.querySelectorAll('[data-suggest-save]').forEach(function (b) {
      b.addEventListener('click', async function (ev) {
        ev.stopPropagation();
        var pid = b.getAttribute('data-suggest-save');
        var input = grid.querySelector('[data-suggest-input="' + pid + '"]');
        var updated = await saveSuggestion(pid, input ? input.value : '');
        if (updated) {
          App.toast('Suggestion saved for ' + pid + ' (local demo).', 'success');
          await renderBoard();
          openDetail(pid, true);
        }
      });
    });
    grid.querySelectorAll('[data-suggest-input]').forEach(function (inp) {
      inp.addEventListener('click', function (ev) { ev.stopPropagation(); });
      inp.addEventListener('keydown', async function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          var pid = inp.getAttribute('data-suggest-input');
          var updated = await saveSuggestion(pid, inp.value);
          if (updated) {
            App.toast('Suggestion saved for ' + pid + ' (local demo).', 'success');
            await renderBoard();
          }
        }
      });
    });
    grid.querySelectorAll('[data-goto-suggest]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var pid = b.getAttribute('data-goto-suggest');
        b.disabled = true;
        try {
          await openDetail(pid);
          var c = document.getElementById('suggestCard');
          if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } finally {
          b.disabled = false;
        }
      });
    });
    // Card-level tel:/mailto: links: keep the native href for mobile, but also
    // offer a demo modal so desktop users (no phone handler) get a working action.
    grid.querySelectorAll('[data-sim-call]').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        // Let mobile handle tel: natively on long-press; single click shows helper.
        // Do not preventDefault here so the tel: link still works where supported.
        var v = a.getAttribute('data-call-value') || a.textContent;
        App.toast('Calling ' + v + ' (demo — use the Contact section for Copy / SMS).', 'info');
      });
    });
    grid.querySelectorAll('[data-sim-email]').forEach(function (a) {
      a.addEventListener('click', function () {
        App.toast('Opening mail to ' + (a.getAttribute('data-email-value') || '') + ' (demo mailto: link).', 'info');
      });
    });
    if (selectedId) openDetail(selectedId, true);
  }

  /* ------------------------------------------------------------- detail */
  async function openDetail(pid, keep) {
    var p = await Storage.getPatient(pid);
    if (!p) { selectedId = null; return; }
    selectedId = pid;
    var r = Risk.assess(p, {});
    var d = (p.wearableData || []).slice(-1)[0] || {};
    var alerts = await Storage.getAlerts(pid);
    var seedAlerts = (p.alerts || []).slice();
    var allAlerts = alerts.concat(seedAlerts).slice().reverse();
    var adviceList = await Storage.getAdvice(pid);
    var medLogs = await Storage.getMedicationLogs(pid);
    var isNurse = session.role === 'nurse';

    var cPhone = contactPhone(p);
    var cEmg = contactEmergency(p);
    var cEmail = contactEmail(p);
    var cPhoneHref = telHref(cPhone);
    var cEmgHref = telHref(cEmg);
    var cEmailHref = mailHref(cEmail);

    var followUps = (window.Clinical ? Clinical.getFollowUps(p) : (p.followUps || []));
    var pendingFU = (window.Clinical ? Clinical.pendingFollowUps(p) : followUps.filter(function (f) { return (f.status || 'open') === 'open'; }));
    var prevInstr = (window.Clinical ? Clinical.getPreviousInstructions(p, adviceList) : []);
    var abha = (window.Clinical ? Clinical.getAbha(p) : { id: '', linked: false });
    var story = (window.Clinical ? Clinical.buildPatientStory(p, r, { adviceList: adviceList, alerts: allAlerts, medLogs: medLogs }) : null);
    var storyHTML = (window.Clinical && story ? Clinical.storyHTML(story) : '<p class="empty">Clinical summary unavailable.</p>');

    var host = document.getElementById('detail');
    host.innerHTML =
      '<div class="card-title"><h2>' + App.esc(p.name) + ' <span class="mono small">' + App.esc(p.id) + '</span></h2>' + App.riskBadge(r.level) + '</div>' +
      '<p class="card-sub">SYNTHETIC DEMO DATA · ' + App.esc(p.condition || '') + ' · consent: ' +
      (p.consent && p.consent.given ? 'given ' + when(p.consent) : 'not given') +
      ' · caregiver sharing: ' + ((p.consent && p.consent.caregiver && p.consent.caregiver.granted) ? 'yes' : 'no') + '</p>' +
      '<div class="btn-row" style="margin-bottom:.6rem"><button type="button" class="btn btn-ghost btn-sm" id="editProfileBtn">✏️ Edit name &amp; profile</button></div>' +

      /* 1) Ready-to-Use Patient Story — structured summary at consultation start */
      '<section class="card" id="storyCard" style="border-left:4px solid var(--brand,#111)" aria-labelledby="storyTitle">' +
      '<div class="card-title"><h3 id="storyTitle" style="margin:0">📋 Patient Story — ready for consultation</h3><span class="tag tag-demo">AUTO SUMMARY</span></div>' +
      '<p class="card-sub">Structured clinical summary: problems, vitals, medicines, adherence, visits, alerts, pending follow-ups and latest instructions — so the consultation starts without searching or repeat questions.</p>' +
      storyHTML +
      '<div class="btn-row" style="margin-top:.6rem"><button type="button" class="btn btn-ghost btn-sm" id="storyCopy">Copy summary</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="storyPrint">Print summary</button></div>' +
      '<p class="fineprint">Synthetic demo summary from local record + explainable risk rules. Not a diagnosis.</p></section>' +

      /* 2) Continuity of Care — medications recap + previous instructions + follow-ups */
      '<section class="card" id="continuityCard" aria-labelledby="contTitle">' +
      '<div class="card-title"><h3 id="contTitle" style="margin:0">🔗 Continuity of Care — instructions &amp; follow-ups</h3><span class="tag tag-demo">' + pendingFU.length + ' PENDING</span></div>' +
      '<p class="card-sub">Tracks current medications, previous instructions and follow-ups so doctors and patients share accurate ongoing information.</p>' +
      '<div class="grid grid-2"><div>' +
      '<h4 style="margin:.2rem 0">Previous instructions (' + prevInstr.length + ')</h4>' +
      (prevInstr.length
        ? '<ul class="list">' + prevInstr.slice(0, 5).map(function (x) {
          return '<li><div class="li-main"><div class="li-title">' + App.esc(x.title) + '</div>' +
            '<div class="li-sub">' + App.esc(String(x.detail || '').slice(0, 160)) + '</div>' +
            '<div class="li-sub">' + App.esc(x.by || '') + ' · ' + App.esc(App.fmtDate(x.date)) + ' · ' + App.esc(x.kind) + '</div></div></li>';
        }).join('') + '</ul>'
        : '<p class="empty">No previous instructions yet — approved advice and notes will appear here.</p>') +
      '</div><div>' +
      '<h4 style="margin:.2rem 0">Follow-ups</h4>' +
      (followUps.length
        ? '<ul class="list" id="fuList">' + followUps.slice().reverse().slice(0, 8).map(function (f) {
          return '<li><div class="li-main"><div class="li-title">' + App.esc(f.title) + ' <span class="tag">' + App.esc(f.status || 'open') + '</span></div>' +
            '<div class="li-sub">Due: ' + App.esc(f.dueDate ? App.fmtDate(f.dueDate) : 'no date') + (f.detail ? ' — ' + App.esc(f.detail) : '') + '</div>' +
            '<div class="li-sub">' + App.esc(f.createdBy || '') + ' · ' + App.esc(App.fmtDate(f.createdAt)) + '</div></div>' +
            ((f.status || 'open') === 'open' && !isNurse ? '<button type="button" class="btn btn-ghost btn-sm" data-fu-done="' + App.esc(f.id) + '">Mark done</button>' : '') + '</li>';
        }).join('') + '</ul>'
        : '<p class="empty">No follow-ups scheduled yet.</p>') +
      (isNurse
        ? '<p class="fineprint">Nurse role: read-only for follow-ups in this demo.</p>'
        : '<div class="field" style="margin-top:.5rem"><label for="fuTitle">New follow-up *</label>' +
          '<input type="text" id="fuTitle" maxlength="120" placeholder="e.g. Recheck BP in 7 days" autocomplete="off"></div>' +
          '<div class="grid grid-2"><div class="field"><label for="fuDue">Due date</label><input type="date" id="fuDue"></div>' +
          '<div class="field"><label for="fuDetail">Detail</label><input type="text" id="fuDetail" maxlength="280" placeholder="e.g. Bring home BP log (demo)"></div></div>' +
          '<p class="fineprint" id="fuMsg" role="alert"></p>' +
          '<div class="btn-row"><button type="button" class="btn btn-primary btn-sm" id="fuAdd">➕ Add follow-up</button></div>') +
      '</div></div></section>' +

      /* 3) ABDM alignment — ABHA demo field + portable export */
      '<section class="card" id="abdmCard" aria-labelledby="abdmTitle">' +
      '<div class="card-title"><h3 id="abdmTitle" style="margin:0">🇮🇳 ABDM / ABHA — demo aligned</h3><span class="tag tag-syn">DEMO, NOT LINKED</span></div>' +
      '<p class="card-sub">Designed to align with Ayushman Bharat Digital Mission concepts (ABHA ID, consent-aware sharing, portable record). <strong>No real ABDM network call is made</strong> — everything stays in this browser.</p>' +
      '<div class="grid grid-2"><div class="field"><label for="abhaIn">ABHA ID (demo field)</label>' +
      '<input type="text" id="abhaIn" class="mono" maxlength="40" placeholder="12-3456-7890-12 or name@abdm" value="' + App.esc(abha.id || '') + '" autocomplete="off">' +
      '<span class="hint">14-digit number or xxx@abdm. Demo format check only.</span>' +
      '<p class="fineprint" id="abhaMsg" role="alert"></p>' +
      '<div class="btn-row" style="margin-top:.4rem">' +
      (isNurse ? '' : '<button type="button" class="btn btn-primary btn-sm" id="abhaSave">Link ABHA (demo)</button>') +
      (abha.id ? '<button type="button" class="btn btn-ghost btn-sm" id="abhaUnlink">Unlink</button>' : '') +
      '<button type="button" class="btn btn-ghost btn-sm" id="abdmExport">⬇ Export ABDM-aligned record (JSON)</button>' +
      (abha.id ? '<button type="button" class="btn btn-ghost btn-sm" id="abhaCopy">Copy ABHA</button>' : '') +
      '</div></div>' +
      '<div><p class="small" style="margin:.2rem 0"><strong>Status:</strong> ' + (abha.id ? 'demo-linked to <span class="mono">' + App.esc(abha.id) + '</span>' : 'not linked (demo)') + '</p>' +
      '<ul class="small" style="margin:.3rem 0;padding-left:1.1rem">' +
      '<li>Consent-aware: export includes consent state; share only with patient consent.</li>' +
      '<li>Portable: one JSON bundles demographics, problems, meds, visits, instructions, follow-ups.</li>' +
      '<li>Real deployment would use ABDM Health ID, Consent Manager, HIP/HIU gateways over FHIR — not present in this offline demo.</li>' +
      '</ul></div></div></section>' +

      '<div class="grid grid-2">' +
      '<div class="stack">' +
      '<section class="card"><h3>Demographics</h3>' +
      '<div class="table-wrap"><table class="tbl"><tbody>' +
      '<tr><th>Age / gender</th><td>' + App.esc(String(p.age)) + ' · ' + App.esc(p.gender || '-') + ' · ' + App.esc(p.bloodGroup || '-') + '</td></tr>' +
      '<tr><th>📞 Phone</th><td>' +
        (cPhone && cPhoneHref
          ? '<a class="mono" href="' + App.esc(cPhoneHref) + '" data-detail-call="phone">' + App.esc(cPhone) + '</a> ' +
            '<span class="btn-row" style="display:inline-flex;margin:0 0 0 .4rem"><a class="btn btn-ghost btn-sm" href="' + App.esc(cPhoneHref) + '" data-detail-call="phone">Call</a>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-copy-phone>Copy</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-sms-phone>SMS (demo)</button></span>'
          : '<span class="muted">not recorded — add it in the Contact section below</span>') + '</td></tr>' +
      '<tr><th>🚨 Emergency</th><td>' +
        (cEmg && cEmgHref
          ? '<a class="mono" href="' + App.esc(cEmgHref) + '" data-detail-call="emg">' + App.esc(cEmg) + '</a> ' +
            '<span class="btn-row" style="display:inline-flex;margin:0 0 0 .4rem"><a class="btn btn-ghost btn-sm" href="' + App.esc(cEmgHref) + '" data-detail-call="emg">Call</a>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-copy-emg>Copy</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-sms-emg>SMS (demo)</button></span>'
          : '<span class="muted">not recorded — optional, add it below</span>') + '</td></tr>' +
      '<tr><th>✉️ Email</th><td>' +
        (cEmail && cEmailHref
          ? '<a class="mono" href="' + App.esc(cEmailHref) + '">' + App.esc(cEmail) + '</a> ' +
            '<span class="btn-row" style="display:inline-flex;margin:0 0 0 .4rem"><a class="btn btn-ghost btn-sm" href="' + App.esc(cEmailHref) + '">Email</a>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-copy-email>Copy</button></span>'
          : '<span class="muted">not recorded</span>') + '</td></tr>' +
      '<tr><th>Diagnosis</th><td>' + App.esc((p.diagnosis || []).join(', ') || p.condition || '-') + '</td></tr>' +
      '<tr><th>Allergies</th><td>' + App.esc((p.allergies || []).join(', ') || 'none recorded') + '</td></tr>' +
      '<tr><th>Language</th><td>' + App.esc(p.language || 'en') + '</td></tr>' +
      '</tbody></table></div>' +
      '<div class="btn-row" style="margin-top:.6rem"><button type="button" class="btn btn-ghost btn-sm" id="jumpContact">📞 Manage phone &amp; email below</button></div></section>' +

      '<section class="card" id="contactCard" aria-labelledby="contactTitle"><div class="card-title"><h3 id="contactTitle" style="margin:0">📞 Contact — phone &amp; email</h3><span class="tag tag-demo">EDITABLE</span></div>' +
      '<p class="card-sub">Call links use <span class="mono">tel:</span>, email links use <span class="mono">mailto:</span>. Edits are validated, saved to the local demo record and written to the audit log.</p>' +
      '<div class="grid grid-2">' +
      '<div class="field"><label for="cPhoneIn">Phone number</label>' +
      '<input type="tel" id="cPhoneIn" class="mono" value="' + App.esc(cPhone) + '" placeholder="+91-9000000001" autocomplete="tel" inputmode="tel" maxlength="20">' +
      '<span class="hint">Digits, spaces, +, - allowed · 7–15 digits. Tap Call to dial via tel: link.</span>' +
      '<div class="btn-row" style="margin-top:.4rem"><a class="btn btn-ghost btn-sm" id="cPhoneCall" href="' + App.esc(cPhoneHref || '#') + '"' + (cPhoneHref ? '' : ' aria-disabled="true" style="opacity:.5;pointer-events:none"') + '>📞 Call</a>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="cPhoneCopy">Copy</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="cPhoneSms">✉️ SMS (demo)</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="cPhoneInfo">Details</button></div></div>' +
      '<div class="field"><label for="cEmgIn">Emergency contact</label>' +
      '<input type="tel" id="cEmgIn" class="mono" value="' + App.esc(cEmg) + '" placeholder="+91-9000000101" autocomplete="tel" inputmode="tel" maxlength="20">' +
      '<span class="hint">Secondary number for emergencies (demo only — never auto-dialled).</span>' +
      '<div class="btn-row" style="margin-top:.4rem"><a class="btn btn-ghost btn-sm" id="cEmgCall" href="' + App.esc(cEmgHref || '#') + '"' + (cEmgHref ? '' : ' aria-disabled="true" style="opacity:.5;pointer-events:none"') + '>📞 Call</a>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="cEmgCopy">Copy</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="cEmgSms">✉️ SMS (demo)</button></div></div>' +
      '</div>' +
      '<div class="field" style="margin-top:.6rem"><label for="cEmailIn">Email address</label>' +
      '<input type="email" id="cEmailIn" class="mono" value="' + App.esc(cEmail) + '" placeholder="pt-1001@demo.local" autocomplete="email" inputmode="email" maxlength="80">' +
      '<span class="hint">Must look like name@example.com. Tap Email to compose via mailto: link.</span>' +
      '<div class="btn-row" style="margin-top:.4rem"><a class="btn btn-ghost btn-sm" id="cEmailBtn" href="' + App.esc(cEmailHref || '#') + '"' + (cEmailHref ? '' : ' aria-disabled="true" style="opacity:.5;pointer-events:none"') + '>✉️ Email</a>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="cEmailCopy">Copy</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="cEmailInfo">Details</button></div></div>' +
      '<p class="fineprint" id="contactMsg" role="alert" aria-live="polite"></p>' +
      '<div class="btn-row"><button type="button" class="btn btn-primary btn-sm" id="contactSave">💾 Save contact</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="contactReset">Reset</button></div>' +
      '<p class="fineprint">Demo safety: saving writes only to this browser (IndexedDB/localStorage) and logs <span class="mono">contact.updated</span> in the audit trail. Nothing is sent over the network. See <a href="privacy.html">Privacy Policy</a>.</p></section>' +

      '<section class="card"><h3>Labs (synthetic)</h3>' +
      '<div class="table-wrap"><table class="tbl"><thead><tr><th>Test</th><th>Value</th></tr></thead><tbody>' +
      ['fastingGlucose', 'postMealGlucose', 'bloodGlucose', 'hba1c', 'totalCholesterol', 'ldl', 'hdl', 'triglycerides', 'creatinine', 'egfr', 'systolicBP', 'diastolicBP', 'spo2', 'respiratoryRate']
        .map(function (k) {
          var l = lab(p, k);
          if (!l) return '';
          return '<tr><td>' + App.esc(l.label) + '</td><td class="num">' + App.esc(String(l.value)) + ' ' + App.esc(l.unit) +
            (l.range ? ' <span class="small muted">(ref ' + App.esc(l.range) + ')</span>' : '') + '</td></tr>';
        }).join('') +
      '</tbody></table></div><p class="fineprint">Synthetic values generated for demonstration. Not real laboratory results.</p></section>' +

      '<section class="card"><h3>Latest wearable reading</h3>' +
      '<div class="pc-metrics">' +
      '<div class="pc-metric"><b>' + App.esc(String(d.heartRate || '-')) + '</b>heart rate bpm</div>' +
      '<div class="pc-metric"><b>' + App.esc(String(d.restingHeartRate || '-')) + '</b>resting bpm</div>' +
      '<div class="pc-metric"><b>' + App.esc(String(d.hrv || '-')) + '</b>HRV ms</div>' +
      '<div class="pc-metric"><b>' + App.esc(String(d.sleepHours || '-')) + 'h</b>sleep (' + App.esc(String(d.sleepQuality || '-')) + ')</div>' +
      '<div class="pc-metric"><b>' + App.esc(String(d.stressScore || '-')) + '</b>stress /100</div>' +
      '<div class="pc-metric"><b>' + App.esc(String(d.respiratoryRate || '-')) + '</b>RR /min</div>' +
      '</div><p class="fineprint">Reading date: ' + App.esc(App.fmtDate(d.date)) + '</p></section>' +

      '<section class="card"><h3>30-day glucose trend</h3>' +
      '<canvas role="img" class="chart" id="docSugar" height="220" aria-label="Glucose trend chart"></canvas>' +
      '<p class="fineprint">Synthetic wearable series. Demo for education only, not medical advice.</p></section>' +
      '</div>' +

      '<div class="stack">' +
      '<section class="card"><h3>Explainable demo risk</h3>' +
      '<div class="row-between"><strong>Score ' + r.score + ' / 100 · ' + App.esc(r.levelLabel) + '</strong>' +
      '<span class="small muted">Wellness ' + (r.wellness ? r.wellness.score : '-') + '/100</span></div>' +
      '<ul class="list">' + r.reasons.map(function (x) { return '<li class="li-sub">' + App.esc(x) + '</li>'; }).join('') + '</ul>' +
      '<div class="table-wrap"><table class="tbl"><thead><tr><th>Demo domain</th><th>Score</th></tr></thead><tbody>' +
      r.breakdown.map(function (b) {
        var col = b.score >= 70 ? 'var(--red)' : b.score >= 40 ? 'var(--yellow)' : 'var(--green)';
        return '<tr><td>' + App.esc(b.label) + '</td><td class="num" style="color:' + col + ';font-weight:700">' + b.score + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="fineprint">Suggested actions: ' + App.esc(r.suggestedActions.join(' · ')) + '</p>' +
      '<details class="disclosure"><summary>How the risk engine works</summary><pre class="fineprint" style="white-space:pre-wrap">' + App.esc(Risk.HOW_IT_WORKS) + '</pre></details>' +
      '<p class="fineprint">' + App.esc(r.disclaimer) + '</p></section>' +

      '<section class="card" id="medCard"><div class="card-title"><h3 style="margin:0">💊 Medicines for this patient</h3><span class="tag tag-demo">' + ((p.medicines || []).length) + ' PRESCRIBED</span></div>' +
      '<p class="card-sub">Medicines prescribed to <strong>' + App.esc(p.name) + ' (' + App.esc(p.id) + ')</strong> only. ' +
      (isNurse ? 'Nurse role: read-only — only a signed-in doctor can add or remove medicines.' : 'Doctor role: you can add an additional medicine below or remove one.') + '</p>' +
      ((p.medicines || []).length
        ? '<ul class="list" id="medScheduleList">' + p.medicines.map(function (m) {
          var freqTxt = App.medFrequency(m);
          var byTxt = m.prescribedBy ? 'Prescribed by ' + App.esc(m.prescribedBy) : '';
          return '<li><div class="li-main"><span class="li-title">' + App.esc(m.name) + ' ' + App.esc(m.dose) + '</span>' +
            '<span class="li-sub">📅 ' + App.esc(App.medDateRange(m)) + '</span>' +
            '<span class="li-sub">🕐 ' + App.esc(App.medTimes(m) || 'no fixed time') + (freqTxt ? ' · ' + App.esc(freqTxt) : '') + '</span>' +
            '<span class="li-sub">🔁 ' + App.esc(App.medSchedule(m)) + '</span>' +
            '<span class="li-sub">' + App.esc(m.instructions || '') + '</span>' +
            (byTxt ? '<span class="li-sub">' + byTxt + '</span>' : '') +
            (m.condition ? '<span class="li-sub">For: ' + App.esc(m.condition) + '</span>' : '') + '</div>' +
            '<div class="btn-row" style="margin:0"><span class="tag">' + App.esc(m.condition || 'general') + '</span>' +
            (isNurse ? '' : '<button type="button" class="btn btn-ghost btn-sm" data-med-del="' + App.esc(m.id) + '" title="Remove ' + App.esc(m.name) + '">Remove</button>') + '</div></li>';
        }).join('') + '</ul>'
        : '<p class="empty">No medicines scheduled for this patient yet — add one below.</p>') +
      '<p class="fineprint">Adherence (7-day demo log): <strong>' + ((p.adherence || {}).percent || 0) + '%</strong> · last statuses: ' +
      App.esc(((p.adherence || {}).last7 || []).join(', ') || 'n/a') + '</p>' +
      '<p class="fineprint">Recent logs: ' + (medLogs.length ? medLogs.slice(-5).map(function (l) {
        return App.esc(l.medicineName || l.medicineId) + '=' + App.esc(l.status) + ' (' + App.esc(l.source) + ')';
      }).join(' · ') : 'none yet') + '</p>' +
      (isNurse
        ? '<p class="empty">🔒 Nurses have read-only access to medicines in this demo. Please ask a doctor (DOC-1001) to add or change a medicine.</p></section>'
        : ('<details class="disclosure" id="medAddWrap" open><summary><strong>➕ Add additional medicine for ' + App.esc(p.name) + ' (' + App.esc(p.id) + ')</strong></summary>' +
      '<p class="card-sub">Adds to this patient only. Saved locally + audit log entry <span class="mono">medicine.added</span>. Synthetic demo entry — not a real prescription. A qualified professional must decide real treatment.</p>' +
      '<datalist id="medCatalogueList"></datalist>' +
      '<div class="grid grid-2">' +
      '<div class="field"><label for="medNameIn">Medicine name *</label><input type="text" id="medNameIn" list="medCatalogueList" maxlength="60" placeholder="e.g. Metformin" autocomplete="off"><span class="hint">Pick from catalogue or type a custom name.</span></div>' +
      '<div class="field"><label for="medDoseIn">Dose / strength *</label><input type="text" id="medDoseIn" maxlength="40" placeholder="e.g. 500 mg"><span class="hint">As written on the demo label.</span></div>' +
      '<div class="field"><label for="medDateIn">Date (date prescribed) *</label><input type="date" id="medDateIn" value="' + App.esc(DemoData.dateFromDaysAgo(0)) + '"><span class="hint">Date the doctor prescribed / to start taking.</span></div>' +
      '<div class="field"><label for="medEndIn">End date <span class="hint">optional</span></label><input type="date" id="medEndIn"><span class="hint">Leave blank for an ongoing medicine.</span></div>' +
      '<div class="field"><label for="medSchedIn">Schedule *</label><select id="medSchedIn">' +
      '<option value="daily" selected>Every day</option>' +
      '<option value="alternate">Alternate days</option>' +
      '<option value="specific">Specific days of week</option>' +
      '<option value="sos">As needed (SOS)</option>' +
      '</select><span class="hint">How often the medicine is taken.</span></div>' +
      '<div class="field" id="medDaysField" hidden><label for="medDaysIn">Days of week</label><input type="text" id="medDaysIn" maxlength="60" placeholder="e.g. Mon, Wed, Fri" autocomplete="off"><span class="hint">Comma separated day names.</span></div>' +
      '<div class="field"><label for="medFreqIn">How many times in a day? *</label><select id="medFreqIn">' +
      '<option value="1|Once daily">Once daily — 1 time</option>' +
      '<option value="2|Twice daily" selected>Twice daily — 2 times</option>' +
      '<option value="3|Thrice daily">Thrice daily — 3 times</option>' +
      '<option value="4|Four times daily">Four times daily — 4 times</option>' +
      '<option value="0|As needed (SOS)">As needed (SOS)</option>' +
      '</select><span class="hint">Sets how many dose-times per day. Times auto-fill, you can edit them.</span></div>' +
      '<div class="field"><label for="medTimesIn">Time(s) — HH:MM, comma separated</label><input type="text" id="medTimesIn" maxlength="60" placeholder="08:00, 20:00" inputmode="numeric" value="08:00, 20:00"><span class="hint">24h format, e.g. 08:00, 14:00, 20:00. Optional for SOS.</span></div>' +
      '<div class="field"><label for="medByIn">Prescribed by (doctor)</label><input type="text" id="medByIn" maxlength="60" placeholder="Dr. Asha Sharma" value="' + App.esc(session ? session.name : '') + '"></div>' +
      '<div class="field"><label for="medCondIn">Condition / reason</label><input type="text" id="medCondIn" maxlength="60" placeholder="e.g. Diabetes" value="' + App.esc(p.condition || '') + '"></div>' +
      '</div>' +
      '<div class="field" style="margin-top:.6rem"><label for="medInstrIn">Instructions (how to take)</label><input type="text" id="medInstrIn" maxlength="120" placeholder="e.g. After food (demo)"></div>' +
      '<p class="fineprint" id="medAddMsg" role="alert" aria-live="polite"></p>' +
      '<div class="btn-row"><button type="button" class="btn btn-primary btn-sm" id="medAddBtn">➕ Add to ' + App.esc(p.id) + '</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="medAddClear">Clear</button></div>' +
      '<p class="fineprint">Demo safety: stored only in this browser (IndexedDB/localStorage). Appears instantly in the patient app, caregiver view and history. See <a href="privacy.html">Privacy Policy</a>.</p>' +
      '</details></section>')) +

      '<section class="card"><h3>Alerts</h3>' +
      (allAlerts.length
        ? '<ul class="list">' + allAlerts.slice(0, 8).map(function (a) {
          var lvl = a.level === 'red' ? 'p-red' : a.level === 'yellow' ? 'p-yellow' : 'p-green';
          return '<li><div class="li-main"><div class="li-title">' + App.esc(a.title) + '</div>' +
            '<div class="li-sub">' + App.esc(a.reason || '') + '</div>' +
            '<div class="li-sub">Action: ' + App.esc(a.action || '-') + ' · ' + App.esc(when(a)) + ' · status ' + App.esc(a.status || 'open') + '</div></div>' +
            '<span class="chip ' + lvl + '" aria-hidden="true">' + App.esc(String(a.level || '').toUpperCase()) + '</span></li>';
        }).join('') + '</ul>'
        : '<p class="empty">No alerts for this patient.</p>') +
      '<div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" id="resolveAlerts">Resolve open alerts</button></div></section>' +
      '</div></div>' +

      '<div class="grid grid-2" style="margin-top:1rem">' +
      '<section class="card"><h3>Visits, appointments &amp; payments</h3>' +
      '<div class="table-wrap"><table class="tbl"><thead><tr><th>When</th><th>Item</th><th>Detail</th></tr></thead><tbody>' +
      (p.visits || []).map(function (v) {
        return '<tr><td>' + App.esc(when(v)) + '</td><td>Visit · ' + App.esc(v.department || '') + '</td><td>' + App.esc(v.notes || '') + ' — ' + App.esc(v.outcome || '') + '</td></tr>';
      }).join('') +
      (p.appointments || []).map(function (a) {
        return '<tr><td>' + App.esc(when(a)) + '</td><td>Appointment · ' + App.esc(a.mode || 'clinic') + '</td><td>' + App.esc(a.department || '') + ' · ' + App.esc(a.doctor || '') + ' · ' + App.esc(a.status || '') + '</td></tr>';
      }).join('') +
      (p.payments || []).map(function (x) {
        return '<tr><td>' + App.esc(when(x)) + '</td><td>' + App.esc(x.category || 'Payment') + '</td><td class="num">₹' + App.esc(String(x.amount)) + ' · ' + App.esc(x.status) + ' <span class="small muted">(demo gateway — no real transaction)</span></td></tr>';
      }).join('') +
      '</tbody></table></div>' +

      '<h3>Doctor notes</h3>' +
      '<ul class="list">' + ((p.doctorNotes || []).length
        ? p.doctorNotes.map(function (n) {
          return '<li><div class="li-main"><div class="li-title">' + App.esc(n.text || n.note || '') + '</div>' +
            '<div class="li-sub">' + App.esc(n.author || n.by || session.name) + ' · ' + App.esc(when(n)) + '</div></div></li>';
        }).join('')
        : '<li class="empty">No notes yet.</li>') + '</ul>' +
      '<div class="btn-row"><input type="text" id="noteIn" placeholder="Add a demo clinical note" aria-label="Clinical note" style="flex:1 1 220px;min-height:44px">' +
      '<button type="button" class="btn btn-ghost btn-sm" id="noteBtn">Save note</button></div>' +
      '</section>' +

      '<section class="card"><h3>Advice — human approval required</h3>' +
      '<p class="fineprint">AI suggestions are not medical diagnoses. High-risk advice is never auto-sent: a qualified professional must review and click Approve &amp; Send.</p>' +
      '<div class="field"><label for="tpl">Template</label><select id="tpl">' +
      ['High glucose after meals — review logs with clinician (demo template)',
        'Low activity — consider a safe walk if the clinician agrees (demo template)',
        'Poor sleep — sleep hygiene discussion (demo template)',
        'High BP trend — recheck and clinician review (demo template)',
        'Low medication adherence — reminder strategy (demo template)',
        'Routine follow-up reminder (demo template)'].map(function (t) { return '<option>' + App.esc(t) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field"><label for="draft">Draft (editable)</label><textarea id="draft" rows="4"></textarea></div>' +
      '<div class="btn-row">' +
      '<button type="button" class="btn btn-primary" id="approveBtn">Approve &amp; Send</button>' +
      '<button type="button" class="btn btn-ghost" id="regenBtn">✨ Regenerate AI draft</button>' +
      '<button type="button" class="btn btn-ghost" id="teleBtn">📹 Book / start consultation (mock)</button>' +
      '</div><div id="teleBox"></div>' +
      '<h4>Sent advice (patient inbox)</h4><ul class="list" id="adviceOut">' +
      (adviceList.length ? adviceList.map(function (a) {
        return '<li><div class="li-main"><div class="li-title">' + App.esc(a.template || 'General') + '</div>' +
          '<div class="li-sub">' + App.esc(a.text) + '</div>' +
          '<div class="li-sub">' + App.esc(a.doctorName || a.doctorId || '') + ' · ' + App.esc(App.fmtDate(a.timestamp)) + ' · ' + App.esc(a.status || 'sent') + '</div></div></li>';
      }).join('') : '<li class="empty">Nothing sent yet for this patient.</li>') + '</ul>' +
      '</section>' +
      '</div>' +

      '<section class="card" id="suggestCard" style="margin-top:1rem" aria-labelledby="suggestTitle">' +
      '<div class="card-title"><h3 id="suggestTitle" style="margin:0">💡 Suggestions for ' + App.esc(p.name) + ' <span class="mono small">' + App.esc(p.id) + '</span></h3><span class="tag tag-demo">' + suggestionsOf(p).length + ' SAVED</span></div>' +
      '<p class="card-sub">One suggestion box per patient. Saved locally to this patient record (IndexedDB/localStorage) + audit log entry <span class="mono">suggestion.saved</span>. Nothing is sent over the network.</p>' +
      '<div class="suggest-row suggest-row-lg">' +
      '<input type="text" id="suggestIn" placeholder="Write a suggestion — e.g. walk 20 min, recheck BP in 3 days…" aria-label="New suggestion" maxlength="280" style="flex:1 1 260px">' +
      '<button type="button" class="btn btn-primary btn-sm" id="suggestBtn">💾 Save suggestion</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="suggestClear">Clear</button>' +
      '</div>' +
      '<p class="fineprint" id="suggestMsg" role="alert" aria-live="polite"></p>' +
      '<ul class="list" id="suggestList">' +
      (suggestionsOf(p).length
        ? suggestionsOf(p).slice().reverse().map(function (s) {
          return '<li><div class="li-main"><div class="li-title">' + App.esc(s.text || '') + '</div>' +
            '<div class="li-sub">' + App.esc(s.author || '') + ' · ' + App.esc(when(s)) + '</div></div>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-suggest-del="' + App.esc(s.id) + '">Delete</button></li>';
        }).join('')
        : '<li class="empty">No suggestions yet for this patient — use the box above.</li>') + '</ul>' +
      '</section>' +

      '<div class="grid grid-2" style="margin-top:1rem">' +
      '<section class="card"><h3>Certificate &amp; record actions</h3>' +
      '<div class="btn-row">' +
      '<button type="button" class="btn btn-ghost btn-sm" id="certBtn">🎓 Generate treatment certificate</button>' +
      '<a class="btn btn-ghost btn-sm" id="certLink" href="#" hidden>Open certificate</a>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="archBtn">Archive record</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="decBtn">Mark deceased</button>' +
      '<button type="button" class="btn btn-danger btn-sm" id="delBtn">Delete record</button>' +
      '</div>' +
      (isNurse ? '<p class="fineprint">Nurse role: administrative actions (archive, deceased, delete, certificate) require a doctor account in this demo.</p>' : '') +
      '<div id="qrBox"></div></section>' +

      '<section class="card"><h3>Consent &amp; privacy state</h3>' +
      '<ul class="list">' +
      consentRow('Data collection', p.consent && p.consent.items && p.consent.items.dataCollection) +
      consentRow('Doctor sharing', p.consent && p.consent.items && p.consent.items.doctorSharing) +
      consentRow('Caregiver sharing', p.consent && p.consent.items && p.consent.items.caregiverSharing) +
      consentRow('Microphone', p.consent && p.consent.items && p.consent.items.microphone) +
      consentRow('Notifications', p.consent && p.consent.items && p.consent.items.notifications) +
      consentRow('AI features', p.consent && p.consent.items && p.consent.items.aiFeatures) +
      '</ul>' +
      '<p class="fineprint">Data minimisation: the caregiver page only ever sees medicines, appointments, alerts and basic wellness when the patient enables sharing.</p>' +
      '<div class="btn-row" style="margin-top:.6rem">' +
      '<a class="btn btn-ghost btn-sm" href="caregiver.html">Open caregiver view</a>' +
      '<a class="btn btn-ghost btn-sm" href="verification.html?id=' + App.esc((p.certId || '')) + '">Verify certificate</a>' +
      '</div></section>' +
      '</div>';

    drawDetailChart(p);
    bindDetail(p, r, isNurse);
    bindEditProfile(p);
    if (!keep) host.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.dispatchEvent(new CustomEvent('vpdt:demoStepDoctor', { detail: { patientId: pid } }));
  }

  /* ------------------------------------------- profile: edit name & details */
  function bindEditProfile(p) {
    var btn = document.getElementById('editProfileBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var body = document.createElement('div');
      body.innerHTML =
        '<p class="small">Patient ID <strong class="mono">' + App.esc(p.id) + '</strong> cannot be changed (sequential demo ID). Everything else below is editable and saved only to this browser.</p>' +
        '<div class="field"><label for="epName">Full name *</label>' +
        '<input type="text" id="epName" maxlength="80" value="' + App.esc(p.name || '') + '" autocomplete="name"></div>' +
        '<div class="grid grid-2">' +
        '<div class="field"><label for="epAge">Age (years) *</label>' +
        '<input type="number" id="epAge" min="0" max="120" value="' + App.esc(String(p.age == null ? '' : p.age)) + '" inputmode="numeric"></div>' +
        '<div class="field"><label for="epGender">Gender</label><select id="epGender">' +
        ['Female', 'Male', 'Other'].map(function (g) {
          return '<option value="' + g + '"' + (String(p.gender || '') === g ? ' selected' : '') + '>' + g + '</option>';
        }).join('') + '</select></div>' +
        '<div class="field"><label for="epBlood">Blood group</label><select id="epBlood">' +
        ['', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(function (g) {
          return '<option value="' + g + '"' + (String(p.bloodGroup || '') === g ? ' selected' : '') + '>' + (g || '—') + '</option>';
        }).join('') + '</select></div>' +
        '<div class="field"><label for="epCond">Condition label</label>' +
        '<input type="text" id="epCond" maxlength="80" value="' + App.esc(p.condition || '') + '" placeholder="e.g. Diabetes"></div>' +
        '</div>' +
        '<p class="fineprint">Synthetic demo record — editing the name updates the triage cards, patient app greeting, caregiver list, audit log and certificates generated after the change.</p>';
      App.modal({
        title: '✏️ Edit patient ' + p.id,
        bodyNode: body,
        actions: [{ label: 'Cancel', value: false }, { label: '💾 Save name & profile', value: true, primary: true }]
      }).then(async function (go) {
        if (!go) return;
        var name = body.querySelector('#epName').value.trim().replace(/\s+/g, ' ');
        var age = parseInt(body.querySelector('#epAge').value, 10);
        var gender = body.querySelector('#epGender').value;
        var blood = body.querySelector('#epBlood').value;
        var cond = body.querySelector('#epCond').value.trim();
        if (name.length < 2) { App.toast('Name needs at least 2 characters.', 'error'); return; }
        if (!/^[A-Za-z][A-Za-z .'\-]*$/.test(name)) { App.toast('Name may only use letters, spaces, dots, hyphens and apostrophes.', 'error'); return; }
        if (isNaN(age) || age < 0 || age > 120) { App.toast('Age must be 0–120.', 'error'); return; }
        try {
          var fresh = await Storage.getPatient(p.id);
          if (!fresh) { App.toast('Patient record not found.', 'error'); return; }
          var oldName = fresh.name;
          fresh.name = name;
          fresh.age = age;
          fresh.gender = gender;
          fresh.bloodGroup = blood;
          if (cond) fresh.condition = cond;
          await Storage.savePatient(fresh);
          await Storage.saveAuditLog({
            actorId: session ? session.id : 'system',
            actorRole: session ? session.role : 'system',
            action: 'patient.updated',
            patientId: p.id,
            message: 'Profile edited: "' + oldName + '" → "' + name + '", age ' + age + ', gender ' + gender + ', blood ' + (blood || '-') + (cond ? ', condition "' + cond + '"' : '') + ' (demo, local only).'
          });
          App.toast('Saved — ' + p.id + ' is now "' + name + '".', 'success');
          await renderBoard();
          await openDetail(p.id, true);
        } catch (e) {
          App.toast('Could not save: ' + (e && e.message ? e.message : 'storage error'), 'error');
        }
      });
    });
  }

  function consentRow(label, val) {
    return '<li><div class="li-main"><span class="li-title">' + App.esc(label) + '</span></div>' +
      '<span class="tag">' + (val ? 'allowed' : 'not allowed') + '</span></li>';
  }

  function drawDetailChart(p) {
    var rows = (p.wearableData || []).slice(-30);
    var labels = rows.map(function (r, i) {
      if (!r.date) return String(i + 1);
      var dt = new Date(r.date + 'T12:00:00');
      return dt.getDate() + '/' + (dt.getMonth() + 1);
    });
    App.lineChart(document.getElementById('docSugar'), {
      labels: labels,
      series: [{ label: 'Blood sugar (mg/dL)', data: rows.map(function (r) { return r.bloodSugar; }), color: '#6e6e6e' }],
      unit: 'mg/dL'
    });
  }

  function makeDraft(p, r, templateText) {
    var first = (r.reasons[0] || 'your readings are in the demo target band');
    var base = templateText || document.getElementById('tpl').value;
    return '[' + (r.level.toUpperCase() + ' · demo risk ' + r.score) + '] ' + base +
      ' Draft prepared from the rule engine: ' + first + '. ' +
      'Suggested next step: ' + ((r.suggestedActions && r.suggestedActions[0]) || 'continue monitoring') + '. ' +
      'Please review, edit and confirm before sending — this text is a demo draft, not medical advice. — ' + (session ? session.name : 'Care team');
  }

  /* ------------------------------------------- contact: display + edit */
  function bindContact(p) {
    function el(id) { return document.getElementById(id); }
    function msg(t, isErr) {
      var m = el('contactMsg');
      if (!m) return;
      m.textContent = t || '';
      m.style.color = isErr ? 'var(--red, #c0392b)' : 'inherit';
    }
    function setLink(node, href) {
      if (!node) return;
      if (href) {
        node.href = href;
        node.removeAttribute('aria-disabled');
        node.style.opacity = '';
        node.style.pointerEvents = '';
      } else {
        node.href = '#';
        node.setAttribute('aria-disabled', 'true');
        node.style.opacity = '.5';
        node.style.pointerEvents = 'none';
      }
    }
    function liveLinks() {
      var ph = el('cPhoneIn') ? el('cPhoneIn').value.trim() : '';
      var em = el('cEmgIn') ? el('cEmgIn').value.trim() : '';
      var ml = el('cEmailIn') ? el('cEmailIn').value.trim() : '';
      setLink(el('cPhoneCall'), telHref(ph));
      setLink(el('cEmgCall'), telHref(em));
      setLink(el('cEmailBtn'), mailHref(ml));
    }
    ['cPhoneIn', 'cEmgIn', 'cEmailIn'].forEach(function (id) {
      var n = el(id);
      if (n) n.addEventListener('input', function () { liveLinks(); msg(''); });
    });

    var jc = el('jumpContact');
    if (jc) jc.addEventListener('click', function () {
      var c = el('contactCard');
      if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    function wireCopy(btnId, getVal, label) {
      var b = el(btnId);
      if (b) b.addEventListener('click', function () {
        var v = getVal();
        if (!v) { App.toast('Nothing to copy yet.', 'error'); return; }
        copyText(v, label);
      });
    }
    // demographics quick-copy buttons (data-* attributes) — prefer live input values
    document.querySelectorAll('[data-copy-phone]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = (el('cPhoneIn') && el('cPhoneIn').value.trim()) || contactPhone(p);
        if (!v) { App.toast('No phone number to copy yet.', 'error'); return; }
        copyText(v, 'Phone number');
      });
    });
    document.querySelectorAll('[data-copy-emg]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = (el('cEmgIn') && el('cEmgIn').value.trim()) || contactEmergency(p);
        if (!v) { App.toast('No emergency contact to copy yet.', 'error'); return; }
        copyText(v, 'Emergency contact');
      });
    });
    document.querySelectorAll('[data-copy-email]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = (el('cEmailIn') && el('cEmailIn').value.trim()) || contactEmail(p);
        if (!v) { App.toast('No email to copy yet.', 'error'); return; }
        copyText(v, 'Email');
      });
    });
    // demographics quick-SMS buttons (demo simulation, never a real SMS)
    function demoSms(value, label) {
      var v = String(value || '').trim();
      if (!v) { msg('No ' + label + ' to message yet — add one below first.', true); App.toast('No ' + label + ' to message.', 'error'); return; }
      if (!isValidPhone(v)) { msg(label + ' looks invalid — use 7–15 digits.', true); App.toast('Invalid ' + label + ' for demo SMS.', 'error'); return; }
      msg('');
      App.toast('Demo SMS simulated to ' + v + ' — no real message sent.', 'success');
    }
    document.querySelectorAll('[data-sms-phone]').forEach(function (b) {
      b.addEventListener('click', function () { demoSms(el('cPhoneIn') && el('cPhoneIn').value, 'phone number'); });
    });
    document.querySelectorAll('[data-sms-emg]').forEach(function (b) {
      b.addEventListener('click', function () { demoSms(el('cEmgIn') && el('cEmgIn').value, 'emergency contact'); });
    });
    // demographics Call links: keep native tel: but explain on desktop via modal on demand
    document.querySelectorAll('[data-detail-call]').forEach(function (a) {
      a.addEventListener('click', function () {
        var which = a.getAttribute('data-detail-call');
        var v = which === 'emg' ? (el('cEmgIn') && el('cEmgIn').value.trim()) : (el('cPhoneIn') && el('cPhoneIn').value.trim());
        // Do not block the native tel: navigation — just inform once.
        App.toast('Dialling ' + (v || 'contact') + ' via tel: link (demo — no auto-call).', 'info');
      });
    });
    wireCopy('cPhoneCopy', function () { return el('cPhoneIn') ? el('cPhoneIn').value.trim() : ''; }, 'Phone number');
    wireCopy('cEmgCopy', function () { return el('cEmgIn') ? el('cEmgIn').value.trim() : ''; }, 'Emergency contact');
    wireCopy('cEmailCopy', function () { return el('cEmailIn') ? el('cEmailIn').value.trim() : ''; }, 'Email');

    function wireSms(btnId, inputId, label) {
      var b = el(btnId);
      if (b) b.addEventListener('click', function () {
        var v = el(inputId) ? el(inputId).value.trim() : '';
        demoSms(v, label);
      });
    }
    wireSms('cPhoneSms', 'cPhoneIn', 'phone number');
    wireSms('cEmgSms', 'cEmgIn', 'emergency contact');

    function wireInfo(btnId, inputId, kind) {
      var b = el(btnId);
      if (b) b.addEventListener('click', function () {
        var v = el(inputId) ? el(inputId).value.trim() : '';
        if (!v) { App.toast('Nothing to show yet — enter a value first.', 'error'); return; }
        var href = kind === 'email' ? mailHref(v) : telHref(v);
        contactActionModal(kind, v, href);
      });
    }
    wireInfo('cPhoneInfo', 'cPhoneIn', 'call');
    wireInfo('cEmailInfo', 'cEmailIn', 'email');

    var reset = el('contactReset');
    if (reset) reset.addEventListener('click', function () {
      el('cPhoneIn').value = contactPhone(p);
      el('cEmgIn').value = contactEmergency(p);
      el('cEmailIn').value = contactEmail(p);
      liveLinks(); msg('');
      App.toast('Contact fields reset.', 'info');
    });

    // Apply correct enabled/disabled state on first render (empty numbers stay disabled, not dead # links).
    liveLinks();

    var save = el('contactSave');
    if (save) save.addEventListener('click', async function () {
      if (!el('cPhoneIn') || !el('cEmgIn') || !el('cEmailIn')) { App.toast('Contact form is not ready yet.', 'error'); return; }
      var ph = el('cPhoneIn').value.trim();
      var em = el('cEmgIn').value.trim();
      var ml = el('cEmailIn').value.trim().toLowerCase();
      if (!ph) { msg('Phone number is required.', true); App.toast('Phone number is required.', 'error'); el('cPhoneIn').focus(); return; }
      if (!isValidPhone(ph)) { msg('Phone looks invalid — use 7–15 digits, e.g. +91-9000000001.', true); App.toast('Invalid phone number.', 'error'); el('cPhoneIn').focus(); return; }
      if (em && !isValidPhone(em)) { msg('Emergency contact looks invalid — use 7–15 digits or leave it empty.', true); App.toast('Invalid emergency contact.', 'error'); el('cEmgIn').focus(); return; }
      if (!ml) { msg('Email address is required.', true); App.toast('Email address is required.', 'error'); el('cEmailIn').focus(); return; }
      if (!isValidEmail(ml)) { msg('Email looks invalid — expected name@example.com.', true); App.toast('Invalid email address.', 'error'); el('cEmailIn').focus(); return; }
      if (ph === em && ph) { msg('Phone and emergency contact should be different numbers.', true); App.toast('Phone and emergency contact should differ.', 'error'); return; }
      try {
        var fresh = await Storage.getPatient(p.id);
        if (!fresh) { msg('Patient record no longer exists locally.', true); App.toast('Patient not found.', 'error'); return; }
        fresh.phone = ph;
        fresh.emergencyContact = em;
        fresh.email = ml;
        await Storage.savePatient(fresh);
        await Storage.saveAuditLog({
          actorId: session ? session.id : 'system',
          actorRole: session ? session.role : 'system',
          action: 'contact.updated',
          patientId: p.id,
          message: 'Contact updated: phone ' + ph + ', emergency ' + (em || '-') + ', email ' + ml + ' (demo, local only).'
        });
        msg('');
        App.toast('Contact saved — phone & email updated locally.', 'success');
        await renderBoard();
        await openDetail(p.id, true);
      } catch (e) {
        msg('Could not save contact: ' + (e && e.message ? e.message : 'storage error'), true);
        App.toast('Could not save contact.', 'error');
      }
    });
  }

  function bindSuggestions(p) {
    var input = document.getElementById('suggestIn');
    var btn = document.getElementById('suggestBtn');
    var clear = document.getElementById('suggestClear');
    var msgEl = document.getElementById('suggestMsg');
    function msg(t, isErr) {
      if (!msgEl) return;
      msgEl.textContent = t || '';
      msgEl.style.color = isErr ? 'var(--red, #c0392b)' : 'inherit';
    }
    if (clear && input) clear.addEventListener('click', function () { input.value = ''; msg(''); input.focus(); });
    async function doSave() {
      if (!input) return;
      var updated = await saveSuggestion(p.id, input.value);
      if (updated) {
        msg('');
        App.toast('Suggestion saved for ' + p.id + ' (local demo).', 'success');
        p = updated;
        openDetail(p.id, true);
        renderBoard();
      } else if (msgEl) {
        msg('Type a suggestion first.', true);
      }
    }
    if (btn) btn.addEventListener('click', doSave);
    if (input) input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); doSave(); }
    });
    document.querySelectorAll('[data-suggest-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var sid = b.getAttribute('data-suggest-del');
        var fresh = await Storage.getPatient(p.id);
        if (!fresh) return;
        fresh.suggestions = suggestionsOf(fresh).filter(function (s) { return s.id !== sid; });
        await Storage.savePatient(fresh);
        await Storage.saveAuditLog({
          actorId: session ? session.id : 'system',
          actorRole: session ? session.role : 'system',
          action: 'suggestion.deleted',
          patientId: p.id,
          message: 'Deleted suggestion ' + sid + ' (demo, local only).'
        });
        App.toast('Suggestion deleted (local demo).', 'info');
        openDetail(p.id, true);
        renderBoard();
      });
    });
  }

  /* ------------------------------------------------- medicines: add/remove */
  function bindMedicines(p) {
    // Fill catalogue suggestions (offline-safe: silently skip if unavailable).
    var dl = document.getElementById('medCatalogueList');
    if (dl && window.DemoData && DemoData.getMedCatalogue) {
      DemoData.getMedCatalogue().then(function (items) {
        var list = items || [];
        var host = document.getElementById('medCatalogueList');
        if (!host) return;
        host.innerHTML = list.map(function (m) {
          var label = m.name + (m.forms && m.forms[0] ? ' — ' + m.forms[0] : '') +
            (m.typicalUse ? ' · ' + m.typicalUse : '');
          return '<option value="' + App.esc(m.name) + '">' + App.esc(label) + '</option>';
        }).join('');
      }).catch(function () { /* catalogue optional */ });
    }

    function msg(t, isErr) {
      var m = document.getElementById('medAddMsg');
      if (!m) return;
      m.textContent = t || '';
      m.style.color = isErr ? 'var(--red, #c0392b)' : 'inherit';
    }

    var clear = document.getElementById('medAddClear');
    if (clear) clear.addEventListener('click', function () {
      ['medNameIn', 'medDoseIn', 'medEndIn', 'medDaysIn', 'medInstrIn'].forEach(function (id) {
        var n = document.getElementById(id);
        if (n) n.value = '';
      });
      var dateEl = document.getElementById('medDateIn');
      if (dateEl) dateEl.value = DemoData.dateFromDaysAgo(0);
      var freqEl = document.getElementById('medFreqIn');
      if (freqEl) freqEl.value = '2|Twice daily';
      var schedEl = document.getElementById('medSchedIn');
      if (schedEl) schedEl.value = 'daily';
      var byEl = document.getElementById('medByIn');
      if (byEl) byEl.value = session ? session.name : '';
      var condEl = document.getElementById('medCondIn');
      if (condEl) condEl.value = p.condition || '';
      applyScheduleUI();
      applyFrequencyTimes(true);
      msg('');
      var first = document.getElementById('medNameIn');
      if (first) first.focus();
    });

    function parseTimes(raw) {
      var parts = String(raw || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      var bad = parts.filter(function (t) { return !/^([01]\d|2[0-3]):[0-5]\d$/.test(t); });
      return { times: parts, bad: bad };
    }

    /* Default dose times per "times in a day" choice (doctor may edit after). */
    function defaultTimesFor(count) {
      if (count === 1) return '08:00';
      if (count === 2) return '08:00, 20:00';
      if (count === 3) return '08:00, 14:00, 20:00';
      if (count === 4) return '08:00, 12:00, 16:00, 20:00';
      return '';
    }

    function applyFrequencyTimes(force) {
      var freqEl = document.getElementById('medFreqIn');
      var timesEl = document.getElementById('medTimesIn');
      if (!freqEl || !timesEl) return;
      var raw = String(freqEl.value || '').split('|')[0];
      var count = parseInt(raw, 10) || 0;
      var next = defaultTimesFor(count);
      // Only overwrite when forced (clear) or when the box is empty/unchanged default.
      var known = ['08:00', '08:00, 20:00', '08:00, 14:00, 20:00', '08:00, 12:00, 16:00, 20:00', ''];
      if (force || known.indexOf(timesEl.value.trim()) !== -1) timesEl.value = next;
    }

    function applyScheduleUI() {
      var schedEl = document.getElementById('medSchedIn');
      var daysField = document.getElementById('medDaysField');
      var freqField = document.getElementById('medFreqIn');
      var timesEl = document.getElementById('medTimesIn');
      if (!schedEl) return;
      var isSos = schedEl.value === 'sos';
      if (daysField) daysField.hidden = schedEl.value !== 'specific';
      if (freqField) freqField.disabled = isSos;
      if (timesEl) timesEl.placeholder = isSos ? 'optional — e.g. 08:00' : '08:00, 20:00';
    }

    var freqSel = document.getElementById('medFreqIn');
    if (freqSel) freqSel.addEventListener('change', function () { applyFrequencyTimes(false); });
    var schedSel = document.getElementById('medSchedIn');
    if (schedSel) schedSel.addEventListener('change', applyScheduleUI);

    var addBtn = document.getElementById('medAddBtn');
    if (addBtn) addBtn.addEventListener('click', async function () {
      if (isNurse) { App.toast('Nurse role is read-only for medicines. A doctor must add medicines.', 'error'); return; }
      var nameEl = document.getElementById('medNameIn');
      var doseEl = document.getElementById('medDoseIn');
      var dateEl = document.getElementById('medDateIn');
      var endEl = document.getElementById('medEndIn');
      var schedEl = document.getElementById('medSchedIn');
      var daysEl = document.getElementById('medDaysIn');
      var freqEl = document.getElementById('medFreqIn');
      var timesEl = document.getElementById('medTimesIn');
      var byEl = document.getElementById('medByIn');
      var condEl = document.getElementById('medCondIn');
      var instrEl = document.getElementById('medInstrIn');
      if (!nameEl || !doseEl) { App.toast('Medicine form is not ready yet.', 'error'); return; }
      var name = nameEl.value.trim().slice(0, 60);
      var dose = doseEl.value.trim().slice(0, 40);
      var startDate = dateEl ? dateEl.value : '';
      var endDate = endEl ? endEl.value : '';
      var schedType = schedEl ? schedEl.value : 'daily';
      var days = daysEl ? daysEl.value.trim().slice(0, 60) : '';
      var by = byEl ? byEl.value.trim().slice(0, 60) : '';
      var cond = condEl ? condEl.value.trim().slice(0, 60) : '';
      var instr = instrEl ? instrEl.value.trim().slice(0, 120) : '';
      var freqParts = String((freqEl && freqEl.value) || '0|').split('|');
      var freqCount = parseInt(freqParts[0], 10) || 0;
      var freqLabel = freqParts[1] || '';
      var parsed = parseTimes(timesEl ? timesEl.value : '');
      var scheduleText = schedType === 'sos' ? 'As needed (SOS)'
        : schedType === 'alternate' ? 'Every other day'
        : schedType === 'specific' ? (days ? 'On ' + days : 'Specific days')
        : 'Every day';

      if (!name) { msg('Medicine name is required.', true); App.toast('Medicine name is required.', 'error'); nameEl.focus(); return; }
      if (!dose) { msg('Dose / strength is required (e.g. 500 mg).', true); App.toast('Dose is required.', 'error'); doseEl.focus(); return; }
      if (!startDate) { msg('Date (date prescribed) is required.', true); App.toast('Date is required.', 'error'); if (dateEl) dateEl.focus(); return; }
      if (endDate && startDate && endDate < startDate) { msg('End date cannot be before the start date.', true); App.toast('End date is before the start date.', 'error'); if (endEl) endEl.focus(); return; }
      if (schedType === 'specific' && !days) { msg('Enter the days of the week (e.g. Mon, Wed, Fri).', true); App.toast('Days of week required.', 'error'); if (daysEl) daysEl.focus(); return; }
      if (parsed.bad.length) { msg('Times must look like HH:MM (24h), e.g. 08:00, 20:00. Bad: ' + parsed.bad.join(', '), true); App.toast('Invalid time format.', 'error'); if (timesEl) timesEl.focus(); return; }
      if (schedType !== 'sos' && !parsed.times.length) { msg('Add at least one dose time, or choose As needed (SOS).', true); App.toast('At least one time is required.', 'error'); if (timesEl) timesEl.focus(); return; }
      try {
        var fresh = await Storage.getPatient(p.id);
        if (!fresh) { msg('Patient record no longer exists locally.', true); return; }
        fresh.medicines = fresh.medicines || [];
        // Prevent exact duplicates (same name + dose, case-insensitive).
        var dup = fresh.medicines.some(function (m) {
          return String(m.name || '').toLowerCase() === name.toLowerCase() &&
            String(m.dose || '').toLowerCase() === dose.toLowerCase();
        });
        if (dup) { msg(name + ' ' + dose + ' is already scheduled for ' + p.id + '.', true); App.toast('Duplicate medicine — already scheduled.', 'error'); return; }
        var entry = {
          id: 'MED-' + String(p.id).replace(/^PT-/, '') + '-' + Date.now().toString(36).toUpperCase(),
          name: name, dose: dose,
          times: parsed.times,
          frequency: schedType === 'sos' ? '' : (freqLabel || (freqCount ? freqCount + '× daily' : '')),
          startDate: startDate || '',
          endDate: endDate || '',
          scheduleType: schedType,
          scheduleDays: schedType === 'specific' ? days : '',
          schedule: scheduleText,
          prescribedBy: by || (session ? session.name : ''),
          prescribedOn: DemoData.dateFromDaysAgo(0),
          instructions: instr || 'As directed (demo)',
          condition: cond || fresh.condition || 'general'
        };
        fresh.medicines.push(entry);
        fresh.timeline = fresh.timeline || [];
        fresh.timeline.push({ day: 'Today', title: 'Medicine added', detail: name + ' ' + dose + ' · ' + scheduleText + ' · ' + (parsed.times.join(', ') || 'no fixed time') + ' — added by ' + (session ? session.name : 'care team') + ' (synthetic demo entry).', type: 'medicines' });
        await Storage.savePatient(fresh);
        await Storage.saveAuditLog({
          actorId: session ? session.id : 'system',
          actorRole: session ? session.role : 'system',
          action: 'medicine.added',
          patientId: p.id,
          message: 'Added ' + name + ' ' + dose + ' from ' + (startDate || '?') + (endDate ? ' to ' + endDate : '') + ' · ' + scheduleText + ' · times ' + (parsed.times.join(', ') || 'none') + ' (prescribed by ' + (entry.prescribedBy || 'care team') + ') for ' + p.id + ' (demo, local only).'
        });
        msg('');
        App.toast(name + ' added for ' + p.id + ' (local demo).', 'success');
        await renderBoard();
        await openDetail(p.id, true);
      } catch (e) {
        msg('Could not add medicine: ' + (e && e.message ? e.message : 'storage error'), true);
        App.toast('Could not add medicine.', 'error');
      }
    });

    applyScheduleUI();

    // Enter key in any add-form input triggers Add.
    ['medNameIn', 'medDoseIn', 'medDateIn', 'medEndIn', 'medDaysIn', 'medTimesIn', 'medByIn', 'medCondIn', 'medInstrIn'].forEach(function (id) {
      var n = document.getElementById(id);
      if (n) n.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); var b = document.getElementById('medAddBtn'); if (b) b.click(); }
      });
    });

    document.querySelectorAll('[data-med-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (isNurse) { App.toast('Nurse role is read-only for medicines. A doctor must remove medicines.', 'error'); return; }
        var mid = b.getAttribute('data-med-del');
        var fresh = await Storage.getPatient(p.id);
        if (!fresh) return;
        var target = (fresh.medicines || []).filter(function (m) { return m.id === mid; })[0];
        if (!target) { App.toast('Medicine not found.', 'error'); return; }
        var ok = await App.confirm('Remove ' + target.name + ' ' + (target.dose || '') + ' from ' + fresh.name + ' (' + fresh.id + ')?\n\nThe patient app will no longer show it. Past logs are kept for audit.', {
          title: 'Remove medicine', danger: true, confirmLabel: 'Remove'
        });
        if (!ok) return;
        fresh.medicines = (fresh.medicines || []).filter(function (m) { return m.id !== mid; });
        fresh.timeline = fresh.timeline || [];
        fresh.timeline.push({ day: 'Today', title: 'Medicine removed', detail: target.name + ' ' + (target.dose || '') + ' removed (synthetic demo entry).', type: 'medicines' });
        await Storage.savePatient(fresh);
        await Storage.saveAuditLog({
          actorId: session ? session.id : 'system',
          actorRole: session ? session.role : 'system',
          action: 'medicine.removed',
          patientId: p.id,
          message: 'Removed ' + target.name + ' ' + (target.dose || '') + ' from ' + p.id + ' (demo, local only).'
        });
        App.toast('Medicine removed (local demo).', 'info');
        await renderBoard();
        await openDetail(p.id, true);
      });
    });
  }

  /* ----------------- Patient Story + Continuity + ABDM (new clinical features) */
  function bindStory(p, r) {
    var cp = document.getElementById('storyCopy');
    if (cp) cp.addEventListener('click', function () {
      var s = Clinical.buildPatientStory(p, r, { adviceList: [], alerts: p.alerts || [], medLogs: [] });
      var txt = 'Patient Story (demo) — ' + p.name + ' (' + p.id + '), ' + p.age + 'y ' + (p.gender || '') +
        '\nProblems: ' + s.problems.join('; ') +
        '\nAllergies: ' + s.allergies +
        '\nRisk: ' + (s.risk ? s.risk.score + '/100 ' + s.risk.label : '-') +
        '\nVitals (' + s.vitals.date + '): BP ' + s.vitals.bp + ', sugar ' + s.vitals.sugar + ', HR ' + s.vitals.hr + ', SpO2 ' + s.vitals.spo2 +
        '\nMeds (' + s.medicines.length + '): ' + s.medicines.join(' | ') +
        '\nAdherence: ' + s.adherence + ' | Last visit: ' + s.lastVisit +
        '\nPending follow-ups: ' + s.pendingFollowUps.map(function (f) { return f.title + (f.dueDate ? ' due ' + f.dueDate : ''); }).join(' | ') +
        '\nLatest instruction: ' + (s.previousInstructions[0] ? s.previousInstructions[0].title + ' — ' + String(s.previousInstructions[0].detail).slice(0, 140) : 'none');
      copyText(txt, 'Patient story');
    });
    var pr = document.getElementById('storyPrint');
    if (pr) pr.addEventListener('click', function () { window.print(); });
  }

  function bindContinuity(p, isNurse) {
    var add = document.getElementById('fuAdd');
    if (add) add.addEventListener('click', async function () {
      var tEl = document.getElementById('fuTitle');
      var dEl = document.getElementById('fuDue');
      var xEl = document.getElementById('fuDetail');
      var mEl = document.getElementById('fuMsg');
      function msg(t, isErr) { if (mEl) { mEl.textContent = t || ''; mEl.style.color = isErr ? 'var(--red,#c0392b)' : 'inherit'; } }
      var title = tEl ? tEl.value.trim() : '';
      var due = dEl ? dEl.value : '';
      var detail = xEl ? xEl.value.trim() : '';
      var err = Clinical.isValidFollowUp(title, due);
      if (err) { msg(err, true); App.toast(err, 'error'); return; }
      try {
        var fresh = await Storage.getPatient(p.id);
        if (!fresh) { msg('Patient record not found.', true); return; }
        fresh.followUps = Clinical.getFollowUps(fresh);
        fresh.followUps.push(Clinical.newFollowUp(title, due, detail, session ? session.name + ' (' + session.id + ')' : 'care team'));
        fresh.timeline = fresh.timeline || [];
        fresh.timeline.push({ day: 'Today', title: 'Follow-up scheduled', detail: title + (due ? ' · due ' + due : ''), type: 'visits' });
        await Storage.savePatient(fresh);
        await Storage.saveAuditLog({
          actorId: session ? session.id : 'system', actorRole: session ? session.role : 'system',
          action: 'followup.scheduled', patientId: p.id,
          message: 'Scheduled follow-up "' + title + '"' + (due ? ' due ' + due : '') + ' for ' + p.id + ' (demo, local only).'
        });
        msg(''); App.toast('Follow-up added (local demo).', 'success');
        await renderBoard(); await openDetail(p.id, true);
      } catch (e) { msg('Could not save follow-up.', true); }
    });
    document.querySelectorAll('[data-fu-done]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var fid = b.getAttribute('data-fu-done');
        var fresh = await Storage.getPatient(p.id);
        if (!fresh) return;
        var hit = false;
        Clinical.getFollowUps(fresh).forEach(function (f) {
          if (f.id === fid && (f.status || 'open') === 'open') { f.status = 'done'; f.doneAt = new Date().toISOString(); hit = true; }
        });
        if (!hit) { App.toast('Follow-up not found.', 'error'); return; }
        await Storage.savePatient(fresh);
        await Storage.saveAuditLog({
          actorId: session ? session.id : 'system', actorRole: session ? session.role : 'system',
          action: 'followup.completed', patientId: p.id, message: 'Marked follow-up ' + fid + ' done (demo, local only).'
        });
        App.toast('Follow-up marked done.', 'success');
        await openDetail(p.id, true);
      });
    });
  }

  function bindAbdm(p, isNurse) {
    var save = document.getElementById('abhaSave');
    if (save) save.addEventListener('click', async function () {
      var inp = document.getElementById('abhaIn');
      var mEl = document.getElementById('abhaMsg');
      function msg(t, isErr) { if (mEl) { mEl.textContent = t || ''; mEl.style.color = isErr ? 'var(--red,#c0392b)' : 'inherit'; } }
      var v = inp ? Clinical.normalizeAbha(inp.value) : '';
      var err = Clinical.isValidAbha(v);
      if (err) { msg(err, true); App.toast(err, 'error'); return; }
      var fresh = await Storage.getPatient(p.id);
      if (!fresh) { msg('Patient record not found.', true); return; }
      fresh.abha = { id: v, linked: true, consent: true, linkedAt: new Date().toISOString(), linkedBy: session ? session.id : 'system' };
      await Storage.savePatient(fresh);
      await Storage.saveAuditLog({
        actorId: session ? session.id : 'system', actorRole: session ? session.role : 'system',
        action: 'abha.linked', patientId: p.id, message: 'Demo-linked ABHA ID ' + v + ' for ' + p.id + ' (local demo only, NOT real ABDM).'
      });
      msg(''); App.toast('ABHA ID demo-linked locally (not real ABDM).', 'success');
      await openDetail(p.id, true);
    });
    var un = document.getElementById('abhaUnlink');
    if (un) un.addEventListener('click', async function () {
      var ok = await App.confirm('Unlink the demo ABHA ID from ' + p.id + '? Local demo field only.', { title: 'Unlink ABHA (demo)' });
      if (!ok) return;
      var fresh = await Storage.getPatient(p.id);
      if (!fresh) return;
      fresh.abha = { id: '', linked: false, consent: false };
      await Storage.savePatient(fresh);
      await Storage.saveAuditLog({
        actorId: session ? session.id : 'system', actorRole: session ? session.role : 'system',
        action: 'abha.unlinked', patientId: p.id, message: 'Demo ABHA unlinked for ' + p.id + ' (local only).'
      });
      App.toast('ABHA demo-link removed.', 'info');
      await openDetail(p.id, true);
    });
    var cp = document.getElementById('abhaCopy');
    if (cp) cp.addEventListener('click', function () {
      var inp = document.getElementById('abhaIn');
      if (inp && inp.value.trim()) copyText(inp.value.trim(), 'ABHA ID');
    });
    var ex = document.getElementById('abdmExport');
    if (ex) ex.addEventListener('click', async function () {
      var adviceList = await Storage.getAdvice(p.id);
      Clinical.downloadAbdmRecord(p, { adviceList: adviceList });
      await Storage.saveAuditLog({
        actorId: session ? session.id : 'system', actorRole: session ? session.role : 'system',
        action: 'abdm.exported', patientId: p.id, message: 'Exported ABDM-aligned demo record for ' + p.id + ' (local JSON download, not a real HIE call).'
      });
      App.toast('ABDM-aligned demo record downloaded (JSON, local only).', 'success');
    });
  }

  function bindDetail(p, r, isNurse) {
    bindContact(p);
    bindSuggestions(p);
    bindMedicines(p);
    bindStory(p, r);
    bindContinuity(p, isNurse);
    bindAbdm(p, isNurse);
    var draftEl = document.getElementById('draft');
    draftEl.value = makeDraft(p, r);

    document.getElementById('tpl').addEventListener('change', function (e) {
      draftEl.value = makeDraft(p, r, e.target.value);
    });
    document.getElementById('regenBtn').addEventListener('click', function () {
      draftEl.value = makeDraft(p, r);
      App.toast('AI-style draft regenerated locally (rule template, no network). Edit before approval.', 'info');
    });

    document.getElementById('approveBtn').addEventListener('click', async function () {
      var level = Risk.assess(p, {}).level;
      if (isNurse && level === 'red') {
        await Storage.saveAuditLog({
          actorId: session.id, actorRole: 'nurse', action: 'advice.escalated', patientId: p.id,
          message: 'Nurse escalated RED-risk advice for doctor approval (demo).'
        });
        App.toast('Nurse role: RED-risk advice is escalated to the doctor, not sent.', 'warning');
        return;
      }
      var text = draftEl.value.trim();
      if (!text) { App.toast('Edit or approve the draft text first.', 'error'); return; }
      var ok = await App.confirm(
        'Send this advice to ' + p.name + '?\n\n"'+ text.slice(0, 260) + (text.length > 260 ? '…' : '') + '"\n\nA qualified healthcare professional must make clinical decisions. This is a demo action stored only in this browser.',
        { title: 'Approve & Send', confirmLabel: 'Approve & Send', typeToConfirm: level === 'red' ? 'SEND' : null }
      );
      if (!ok) return;
      var record = {
        patientId: p.id, doctorId: session.id, doctorName: session.name,
        template: document.getElementById('tpl').value, text: text,
        status: 'sent', aiDraft: true, riskAtSend: r.level
      };
      await Storage.saveAdvice(record);
      await Storage.saveAuditLog({
        actorId: session.id, actorRole: session.role, action: 'advice.approved', patientId: p.id,
        message: session.name + ' approved advice for ' + p.id + ' (risk ' + r.level + ', score ' + r.score + '). Human approval recorded.'
      });
      p.timeline = p.timeline || [];
      p.timeline.push({ day: 'Today', title: 'Doctor approved advice', detail: text.slice(0, 120), type: 'advice' });
      await Storage.savePatient(p);
      App.toast('Advice approved and added to the patient inbox (local demo).', 'success');
      openDetail(p.id, true);
    });

    document.getElementById('teleBtn').addEventListener('click', function () {
      var box = document.getElementById('teleBox');
      box.innerHTML = '<div class="info-box" style="margin-top:.7rem"><strong>Mock teleconsultation</strong>' +
        '<p class="small">Shared summary: risk ' + App.esc(r.level) + ' (' + r.score + ') · BP ' +
        App.esc(String((p.wearableData || []).slice(-1)[0].systolicBP || '-')) + '/' + App.esc(String((p.wearableData || []).slice(-1)[0].diastolicBP || '-')) +
        ' · adherence ' + ((p.adherence || {}).percent || 0) + '% · open alerts ' + (allAlertCount()) + '</p>' +
        '<div class="btn-row"><button type="button" class="btn btn-primary btn-sm" id="tstart">Book + start (mock)</button></div>' +
        '<p class="fineprint" id="tstat"></p></div>';
      document.getElementById('tstart').addEventListener('click', async function () {
        await Storage.saveConsult({
          id: 'CONS-' + Date.now(), patientId: p.id, doctorId: session.id,
          bookedAt: new Date().toISOString(), mode: 'teleconsult-mock',
          note: 'MOCK consultation — no real video or phone call takes place.'
        });
        await Storage.saveAuditLog({
          actorId: session.id, actorRole: session.role, action: 'consult.started', patientId: p.id,
          message: 'Mock teleconsultation started for ' + p.id + ' (no real connection).'
        });
        document.getElementById('tstat').textContent = 'Consultation booked and started (MOCK — no real video). A summary was attached to the local record.';
        App.toast('Mock consultation started (no real call).', 'info');
      });
    });

    document.getElementById('resolveAlerts').addEventListener('click', async function () {
      var open = (await Storage.getAlerts(p.id)).filter(function (a) { return a.status === 'open'; });
      open.forEach(function (a) { a.status = 'resolved'; a.resolvedBy = session.id; });
      for (var i = 0; i < open.length; i++) await Storage.saveAlert(open[i]);
      p.alerts = (p.alerts || []).map(function (a) { a.status = 'resolved'; return a; });
      await Storage.savePatient(p);
      await Storage.saveAuditLog({
        actorId: session.id, actorRole: session.role, action: 'alerts.resolved', patientId: p.id,
        message: 'Resolved ' + open.length + ' demo alert(s).'
      });
      App.toast('Resolved ' + open.length + ' alert(s).', 'success');
      openDetail(p.id, true);
    });

    document.getElementById('noteBtn').addEventListener('click', async function () {
      var v = document.getElementById('noteIn').value.trim();
      if (!v) { App.toast('Type a note first.', 'error'); return; }
      p.doctorNotes = p.doctorNotes || [];
      p.doctorNotes.push({ id: 'NOTE-' + Date.now(), author: session.name + ' (' + session.id + ')', text: v, date: DemoData.dateFromDaysAgo(0) });
      await Storage.savePatient(p);
      await Storage.saveAuditLog({
        actorId: session.id, actorRole: session.role, action: 'note.saved', patientId: p.id, message: v.slice(0, 120)
      });
      App.toast('Note saved to the local record.', 'success');
      openDetail(p.id, true);
    });

    document.getElementById('certBtn').addEventListener('click', async function () {
      if (isNurse) { App.toast('Certificates are generated by a doctor account in this demo.', 'warning'); return; }
      var cert = await Certificate.generate(p, { doctorId: session.id, doctorName: session.name, signature: '(demo signature of ' + session.name + ')' });
      document.getElementById('qrBox').innerHTML = '<p class="fineprint">Certificate <strong>' + App.esc(cert.id) + '</strong> generated (SYNTHETIC DEMO DATA, not a medical or legal document).</p><div id="qrHost" class="center"></div>';
      var link = document.getElementById('certLink');
      link.href = Certificate.urlFor(cert.id);
      link.hidden = false;
      var cv = document.createElement('canvas');
      cv.width = 160; cv.height = 160;
      document.getElementById('qrHost').appendChild(cv);
      QR.draw(cv, Certificate.verificationUrl(cert.id), { scale: 4 });
      App.toast('Certificate generated. QR encodes only the certificate ID.', 'success');
    });

    document.getElementById('archBtn').addEventListener('click', async function () {
      if (isNurse) { App.toast('Archive requires a doctor account in this demo.', 'warning'); return; }
      var ok = await App.confirm('Archive ' + p.name + '? The record stays in local storage but is hidden from the active triage list.', { title: 'Archive record', danger: true, confirmLabel: 'Archive' });
      if (!ok) return;
      await Storage.archivePatient(p.id);
      await Storage.saveAuditLog({ actorId: session.id, actorRole: session.role, action: 'patient.archived', patientId: p.id, message: 'Record archived (demo).' });
      selectedId = null;
      renderBoard();
    });

    document.getElementById('decBtn').addEventListener('click', async function () {
      if (isNurse) { App.toast('This action requires a doctor account in this demo.', 'warning'); return; }
      var ok = await App.confirm('Mark ' + p.name + ' as deceased? This stops demo alerts and reminders for the record.', {
        title: 'Mark deceased', danger: true, confirmLabel: 'Mark deceased', typeToConfirm: 'DELETE'
      });
      if (!ok) return;
      p.deceased = true;
      p.status = 'archived';
      await Storage.savePatient(p);
      await Storage.saveAuditLog({ actorId: session.id, actorRole: session.role, action: 'patient.deceased', patientId: p.id, message: 'Record marked deceased (demo archive).' });
      selectedId = null;
      renderBoard();
    });

    document.getElementById('delBtn').addEventListener('click', async function () {
      if (isNurse) { App.toast('Deletion requires a doctor account in this demo.', 'warning'); return; }
      var ok = await App.confirm('Delete ' + p.name + ' (' + p.id + ')? This removes the demo record from this browser only.', {
        title: 'Delete record', danger: true, confirmLabel: 'Delete', typeToConfirm: 'DELETE'
      });
      if (!ok) return;
      await Storage.saveAuditLog({ actorId: session.id, actorRole: session.role, action: 'patient.deleted', patientId: p.id, message: 'Demo record deleted from local store.' });
      await Storage.deletePatient(p.id);
      selectedId = null;
      App.toast('Record deleted from this browser.', 'success');
      renderBoard();
    });
  }

  function allAlertCount() {
    var host = document.getElementById('detail');
    return host ? host.querySelectorAll('.list .chip').length : 0;
  }

  /* ------------------------------------------- register patient (sequential) */
  function conditionOptionsHTML(selected) {
    var list = (window.DemoData && DemoData.CONDITIONS) || [{ name: 'Stable', group: 'General' }];
    var groups = {};
    list.forEach(function (c) {
      var g = c.group || 'General';
      groups[g] = groups[g] || [];
      groups[g].push(c.name);
    });
    return Object.keys(groups).sort().map(function (g) {
      return '<optgroup label="' + App.esc(g) + '">' + groups[g].map(function (n) {
        return '<option value="' + App.esc(n) + '"' + (n === selected ? ' selected' : '') + '>' + App.esc(n) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
  }
  async function openRegisterPatient() {
    var all = await Storage.getAllPatients();
    var newId = nextPatientId(all);
    var body = document.createElement('div');
    body.innerHTML =
      '<div class="info-box" style="margin-bottom:.7rem"><strong>Next patient number: <span class="mono">' + App.esc(newId) + '</span></strong><br>' +
      '<span class="small">Auto-assigned sequentially from the highest existing ID — never random. Deleting or archiving never reuses a number.</span></div>' +
      '<div class="grid grid-2">' +
      '<div class="field"><label for="npName">Full name *</label><input type="text" id="npName" maxlength="60" placeholder="Patient name" autocomplete="name"></div>' +
      '<div class="field"><label for="npAge">Age *</label><input type="number" id="npAge" min="1" max="120" placeholder="52"></div>' +
      '<div class="field"><label for="npGender">Gender</label><select id="npGender"><option>Female</option><option>Male</option><option>Other</option><option>Prefer not to say</option></select></div>' +
      '<div class="field"><label for="npBlood">Blood group</label><input type="text" id="npBlood" maxlength="8" placeholder="O+"></div>' +
      '<div class="field"><label for="npPhone">Phone number *</label><input type="tel" id="npPhone" maxlength="20" placeholder="+91-9000000001" autocomplete="tel" inputmode="tel"><span class="hint">7–15 digits. Powers tel: call links.</span></div>' +
      '<div class="field"><label for="npEmail">Email address *</label><input type="email" id="npEmail" maxlength="80" placeholder="pt-1011@demo.local" autocomplete="email" inputmode="email"><span class="hint">name@example.com. Powers mailto: links.</span></div>' +
      '<div class="field"><label for="npEmg">Emergency contact</label><input type="tel" id="npEmg" maxlength="20" placeholder="+91-9000000101" autocomplete="tel" inputmode="tel"><span class="hint">Optional, must differ from phone.</span></div>' +
      '<div class="field"><label for="npCond">Condition / disease (' + ((window.DemoData && DemoData.CONDITIONS && DemoData.CONDITIONS.length) || '') + ' options)</label><select id="npCond">' + conditionOptionsHTML('Stable') + '</select><span class="hint">Demo catalogue only — not a diagnosis. Medicines auto-filled as synthetic placeholders.</span></div>' +
      '<div class="field"><label for="npAllergies">Allergies <span class="hint">comma separated, or none</span></label><input type="text" id="npAllergies" maxlength="120" placeholder="None"></div>' +
      '</div>' +
      '<p class="fineprint">Saved locally only (IndexedDB/localStorage) + audit log entry. Nothing is sent over the network. Medicines are synthetic demo placeholders, not prescriptions.</p>' +
      '<p class="fineprint" id="npMsg" role="alert"></p>';
    App.modal({
      title: 'Register patient · ' + newId, bodyNode: body,
      actions: [
        { label: 'Cancel', value: false },
        {
          label: 'Register ' + newId, primary: true, onClick: async function () {
            var msg = body.querySelector('#npMsg');
            function err(t) { if (msg) { msg.textContent = t; msg.style.color = 'var(--red, #c0392b)'; } App.toast(t, 'error'); }
            var name = body.querySelector('#npName').value.trim();
            var age = parseInt(body.querySelector('#npAge').value, 10);
            var phone = body.querySelector('#npPhone').value.trim();
            var email = body.querySelector('#npEmail').value.trim().toLowerCase();
            var emg = body.querySelector('#npEmg').value.trim();
            if (!name) { err('Full name is required.'); return false; }
            if (!(age >= 1 && age <= 120)) { err('Enter an age between 1 and 120.'); return false; }
            if (!phone) { err('Phone number is required.'); return false; }
            if (!isValidPhone(phone)) { err('Phone looks invalid — use 7–15 digits.'); return false; }
            if (!email) { err('Email address is required.'); return false; }
            if (!isValidEmail(email)) { err('Email looks invalid — expected name@example.com.'); return false; }
            if (emg && !isValidPhone(emg)) { err('Emergency contact looks invalid.'); return false; }
            if (emg && emg === phone) { err('Phone and emergency contact should differ.'); return false; }
            var fresh = await Storage.getAllPatients();
            var finalId = nextPatientId(fresh);
            var cond = body.querySelector('#npCond').value || 'Stable';
            var algRaw = body.querySelector('#npAllergies') ? body.querySelector('#npAllergies').value : '';
            var allergies = String(algRaw || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
            var meds = [];
            // Medicines are NOT auto-assigned here. After registering, a doctor
            // adds them from the patient's "Medicines & adherence" section
            // (medicine name, date, time(s) and schedule).
            var profile = (window.DemoData && DemoData.profileForCondition) ? DemoData.profileForCondition(cond) : { scenario: 'new', restingHR: 72, hrv: 40, steps: 6000, sleep: 7, sleepQuality: 70, spo2: 98, systolic: 122, diastolic: 78, sugar: 100, rr: 16, stress: 40, trend: 'stable' };
            var rec = {
              id: finalId,
              name: name, age: age,
              gender: body.querySelector('#npGender').value,
              bloodGroup: body.querySelector('#npBlood').value.trim() || '-',
              phone: phone, email: email, emergencyContact: emg,
              language: 'en', wakePhrase: 'help me assistant 3056',
              allergies: allergies,
              diagnosis: (cond === 'Healthy' || cond === 'Stable') ? [] : [cond + ' (synthetic demo)'],
              condition: cond,
              labs: {}, medicines: meds, visits: [], appointments: [], payments: [], doctorNotes: [], advice: [], alerts: [],
              timeline: [{ day: 1, title: 'Registration', detail: 'Registered by ' + (session ? session.name : 'care team') + ' as ' + finalId + ' (sequential) with condition "' + cond + '". Phone + email recorded. Add medicines from the Medicines section.', type: 'info' }],
              treatment: { condition: cond, startDaysAgo: 0, status: 'ongoing', summary: [] },
              wearableProfile: profile,
              adherence: { percent: 100, last7: [] },
              consent: { given: false, items: {}, caregiver: { granted: false, scope: [] } },
              status: 'active', synthetic: true
            };
            rec.wearableData = DemoData.generateSeries(finalId, rec.wearableProfile);
            await Storage.savePatient(rec);
            await Storage.saveAuditLog({
              actorId: session ? session.id : 'system', actorRole: session ? session.role : 'system',
              action: 'patient.registered', patientId: finalId,
              message: 'Registered ' + name + ' as ' + finalId + ' (sequential) — condition ' + cond + ', phone ' + phone + ', email ' + email + ' (demo, local only).'
            });
            App.toast('Patient registered: ' + finalId + ' (' + cond + '). Add medicines from the Medicines section.', 'success');
            await renderBoard();
            openDetail(finalId, true);
            return true;
          }
        }
      ]
    });
  }

  /* --------------------------- visible "Doctors & care team" section */
  async function renderCareTeam() {
    var host = document.getElementById('careTeamRows');
    if (!host) return;
    var staff = await DemoData.getStaff();
    staff = staff.slice().sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
    var countEl = document.getElementById('careTeamCount');
    if (countEl) countEl.textContent = staff.length + ' ACCOUNT' + (staff.length === 1 ? '' : 'S');
    if (!staff.length) {
      host.innerHTML = '<tr><td colspan="5" class="empty">No staff accounts yet.</td></tr>';
      return;
    }
    var canManage = !!(session && session.role === 'doctor');
    host.innerHTML = staff.map(function (s) {
      var manage = s.custom
        ? (canManage
          ? '<button type="button" class="btn btn-ghost btn-sm" data-remove-staff="' + App.esc(s.id) + '">Remove</button>'
          : '<span class="small muted">Added (doctor only)</span>')
        : '<span class="small muted">Built-in demo</span>';
      return '<tr>' +
        '<td class="mono">' + App.esc(s.id) + '</td>' +
        '<td>' + App.esc(s.name) + (s.custom ? ' <span class="tag tag-demo">ADDED</span>' : '') + '</td>' +
        '<td>' + App.esc(DemoData.staffRoleLabel(s.role)) + '</td>' +
        '<td class="small">' + App.esc(s.speciality || '—') + '</td>' +
        '<td>' + manage + '</td>' +
        '</tr>';
    }).join('');
  }

  /* ------------------------------------------- add doctor / care team */
  async function openRegisterStaff(afterSave) {
    var all = await DemoData.getStaff();
    var body = document.createElement('div');
    body.innerHTML =
      '<div class="info-box" style="margin-bottom:.7rem"><strong>Next staff ID: <span class="mono" id="nsId">—</span></strong><br>' +
      '<span class="small">Assigned sequentially from the highest existing ID for the chosen role — never random. Demo account only.</span></div>' +
      '<div class="grid grid-2">' +
      '<div class="field"><label for="nsRole">Role *</label><select id="nsRole"><option value="doctor">Doctor</option><option value="nurse">Nurse</option></select></div>' +
      '<div class="field"><label for="nsName">Full name *</label><input type="text" id="nsName" maxlength="60" placeholder="Dr. Example Name" autocomplete="off"></div>' +
      '<div class="field"><label for="nsSpec">Speciality</label><input type="text" id="nsSpec" maxlength="80" placeholder="General Medicine"></div>' +
      '<div class="field"><label for="nsPin">Sign-in PIN *</label><input type="password" id="nsPin" maxlength="8" inputmode="numeric" placeholder="4–8 digits"><span class="hint">Demo PIN, stored in this browser only. Never use a real password.</span></div>' +
      '</div>' +
      '<p class="fineprint">Saved locally only (this browser) and written to the audit log. Nothing is sent over the network. Demo for education only, not medical advice.</p>' +
      '<p class="fineprint" id="nsMsg" role="alert"></p>';

    var roleSel = body.querySelector('#nsRole');
    function refreshNextId() { body.querySelector('#nsId').textContent = DemoData.nextStaffId(all, roleSel.value); }
    roleSel.addEventListener('change', refreshNextId);
    refreshNextId();

    return App.modal({
      title: 'Add doctor / staff',
      bodyNode: body,
      actions: [
        { label: 'Cancel', value: false },
        {
          label: 'Add to care team', primary: true, onClick: async function () {
            var msg = body.querySelector('#nsMsg');
            function err(t) { if (msg) { msg.textContent = t; msg.style.color = 'var(--red, #c0392b)'; } App.toast(t, 'error'); }
            var name = body.querySelector('#nsName').value.trim();
            if (!name) { err('Please enter the full name.'); return false; }
            var pin = body.querySelector('#nsPin').value.trim();
            if (!/^\d{4,8}$/.test(pin)) { err('The PIN must be 4–8 digits.'); return false; }
            try {
              var rec = await DemoData.addStaff({
                name: name,
                role: roleSel.value,
                speciality: body.querySelector('#nsSpec').value.trim(),
                pin: pin
              });
              await Storage.saveAuditLog({
                actorId: session ? session.id : 'system',
                actorRole: session ? session.role : 'system',
                action: 'staff.added',
                patientId: null,
                message: 'Added ' + DemoData.staffRoleLabel(rec.role) + ' ' + rec.name + ' (' + rec.id + ') to the care team (demo, local only).'
              });
              App.toast(DemoData.staffRoleLabel(rec.role) + ' ' + rec.name + ' added as ' + rec.id + '.', 'success');
              await renderCareTeam();
              if (typeof afterSave === 'function') await afterSave(rec);
              return rec;
            } catch (e) { err(e && e.message ? e.message : 'Could not add staff.'); return false; }
          }
        }
      ]
    });
  }

  /* ------------------------------------------------ care team accounts */
  async function openTeamList() {
    var staff = await DemoData.getStaff();
    staff = staff.slice().sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
    var rows = staff.map(function (s) {
      return '<tr>' +
        '<td class="mono">' + App.esc(s.id) + '</td>' +
        '<td>' + App.esc(s.name) + (s.custom ? ' <span class="tag tag-demo">ADDED</span>' : '') + '</td>' +
        '<td>' + App.esc(DemoData.staffRoleLabel(s.role)) + '</td>' +
        '<td class="small">' + App.esc(s.speciality || '—') + '</td>' +
        '</tr>';
    }).join('');
    var body = document.createElement('div');
    body.innerHTML =
      '<p class="small">' + staff.length + ' care-team account(s) can sign in to this dashboard in the demo. PINs are never shown here.</p>' +
      '<div class="table-wrap" style="max-height:50vh;overflow:auto"><table class="tbl"><thead><tr><th>Staff ID</th><th>Name</th><th>Role</th><th>Speciality</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="4" class="empty">No staff accounts yet.</td></tr>') +
      '</tbody></table></div>' +
      '<p class="fineprint">Demo accounts use a PIN and are stored in this browser only. A production system needs secure identity management — this is not that.</p>';
    var choice = await App.modal({
      title: 'Care team accounts',
      bodyNode: body,
      actions: [
        { label: 'Close', value: false },
        { label: '＋ Add doctor / staff', primary: true, value: 'add' }
      ]
    });
    if (choice === 'add') openRegisterStaff(function () { openTeamList(); });
  }

  /* -------------------------------------------------------- board tools */
  function populateConditionFilter() {
    var sel = document.getElementById('fc');
    if (!sel) return;
    var list = (window.DemoData && DemoData.CONDITIONS) || [];
    if (!list.length) return;
    var cur = sel.value || '';
    var html = '<option value="">All conditions (' + list.length + ')</option>' +
      '<option value="healthy">Healthy / stable</option>';
    var groups = {};
    list.forEach(function (c) {
      if (c.name === 'Healthy' || c.name === 'Stable' || c.name === 'Elderly wellness') return;
      var g = c.group || 'General';
      groups[g] = groups[g] || [];
      groups[g].push(c.name);
    });
    html += Object.keys(groups).sort().map(function (g) {
      return '<optgroup label="' + App.esc(g) + '">' + groups[g].map(function (n) {
        return '<option value="' + App.esc(n.toLowerCase()) + '">' + App.esc(n) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
    sel.innerHTML = html;
    // Restore previous selection if it still exists, else reset to All.
    var has = Array.prototype.some.call(sel.options, function (o) { return o.value === cur; });
    sel.value = has ? cur : '';
    filters.cond = sel.value;
  }
  function bindBoard() {
    populateConditionFilter();
    document.getElementById('fq').addEventListener('input', function (e) { filters.q = e.target.value; renderBoard(); });
    document.getElementById('fr').addEventListener('change', function (e) { filters.risk = e.target.value; renderBoard(); });
    document.getElementById('fc').addEventListener('change', function (e) { filters.cond = e.target.value; renderBoard(); });
    document.getElementById('fs').addEventListener('change', function (e) { filters.sort = e.target.value; renderBoard(); });

    document.getElementById('syncBtn').addEventListener('click', function () { Sync.flush(); });
    // (+) Add patient: toolbar button, header plus-button and floating FAB all open the same form.
    ['addPatientBtn', 'addPatientBtn2', 'addPatientFab'].forEach(function (id) {
      var b = document.getElementById(id);
      if (b && !b.dataset.bound) { b.dataset.bound = '1'; b.addEventListener('click', openRegisterPatient); }
    });
    // (+) Add doctor / staff: header button and the toolbar "Care team" button.
    var addStaffBtn = document.getElementById('addStaffBtn');
    if (addStaffBtn && !addStaffBtn.dataset.bound) {
      addStaffBtn.dataset.bound = '1';
      addStaffBtn.addEventListener('click', function () { openRegisterStaff(); });
    }
    var teamBtn = document.getElementById('teamBtn');
    if (teamBtn && !teamBtn.dataset.bound) {
      teamBtn.dataset.bound = '1';
      teamBtn.addEventListener('click', openTeamList);
    }
    // "Doctors & care team" section: add button + per-row Remove action.
    var addStaffBtn3 = document.getElementById('addStaffBtn3');
    if (addStaffBtn3 && !addStaffBtn3.dataset.bound) {
      addStaffBtn3.dataset.bound = '1';
      addStaffBtn3.addEventListener('click', function () { openRegisterStaff(); });
    }
    var careTeamRows = document.getElementById('careTeamRows');
    if (careTeamRows && !careTeamRows.dataset.bound) {
      careTeamRows.dataset.bound = '1';
      careTeamRows.addEventListener('click', async function (e) {
        var b = e.target.closest ? e.target.closest('[data-remove-staff]') : null;
        if (!b) return;
        if (!session || session.role !== 'doctor') { App.toast('Removing an account requires a doctor account in this demo.', 'warning'); return; }
        var id = b.getAttribute('data-remove-staff');
        var ok = await App.confirm('Remove the demo account ' + id + ' from this browser?\n\nThey will not be able to sign in again until re-added.', {
          title: 'Remove account', danger: true, confirmLabel: 'Remove'
        });
        if (!ok) return;
        await DemoData.removeStaff(id);
        await Storage.saveAuditLog({
          actorId: session ? session.id : 'system',
          actorRole: session ? session.role : 'system',
          action: 'staff.removed',
          patientId: null,
          message: 'Removed care-team account ' + id + ' (demo, local only).'
        });
        App.toast('Account ' + id + ' removed.', 'success');
        renderCareTeam();
      });
    }
    document.getElementById('archToggle').addEventListener('click', function () {
      filters.archived = !filters.archived;
      this.setAttribute('aria-pressed', String(filters.archived));
      this.style.fontWeight = filters.archived ? '800' : '';
      renderBoard();
    });
    document.getElementById('offlineBtn').addEventListener('click', function () {
      var next = !App.isOffline();
      App.setSimulatedOffline(next);
      document.getElementById('offlineBtn').textContent = next ? '🔌 Go back online' : '🔌 Simulate offline';
    });

    document.getElementById('bcBtn').addEventListener('click', function () {
      var body = document.createElement('div');
      body.innerHTML =
        '<p class="small">Broadcast reaches demo patients in this browser only. Nothing is emailed or sent to a real person.</p>' +
        '<div class="field"><label for="bcGroup">Group</label><select id="bcGroup">' +
        '<option>Diabetes patients</option><option>Hypertension / cardiac patients</option>' +
        '<option>Respiratory patients</option><option>Metabolic patients</option>' +
        '<option>Bone &amp; joint patients</option><option>Digestive patients</option>' +
        '<option>Neuro &amp; sleep patients</option><option>Skin &amp; allergy patients</option>' +
        '<option>Kidney &amp; urinary patients</option>' +
        '<option>All active patients</option></select></div>' +
        '<div class="field"><label for="bcText">Advice text</label><textarea id="bcText" rows="3">Gentle reminder: keep taking your medicines as prescribed and contact a qualified healthcare professional with any concerns. (Demo message)</textarea></div>';
      App.modal({
        title: 'Broadcast advice', bodyNode: body,
        actions: [
          { label: App.t('cancel'), value: false },
          {
            label: 'Send to group', primary: true, onClick: async function () {
              var group = body.querySelector('#bcGroup').value;
              var text = body.querySelector('#bcText').value.trim() || 'General wellness reminder (demo)';
              var n = 0;
              var all = await Storage.getAllPatients();
              for (var i = 0; i < all.length; i++) {
                var p = all[i];
                if ((p.status || 'active') === 'archived' || p.deceased) continue;
                var hay = (p.condition || '') + ' ' + (p.diagnosis || []).join(' ');
                var hit = group.indexOf('All') === 0 ||
                  (group.indexOf('Diab') === 0 && /diabet/i.test(hay)) ||
                  (group.indexOf('Hyper') === 0 && /hypertens|heart|cholesterol/i.test(hay)) ||
                  (group.indexOf('Resp') === 0 && /asthma|copd|rhinitis|sinus/i.test(hay)) ||
                  (group.indexOf('Metab') === 0 && /diabet|obesity|cholesterol|thyroid|gout|fatty/i.test(hay)) ||
                  (group.indexOf('Bone') === 0 && /arthrit|osteopor|back pain|spondyl|gout/i.test(hay)) ||
                  (group.indexOf('Diges') === 0 && /liver|reflux|gerd|bowel|gastr/i.test(hay)) ||
                  (group.indexOf('Neuro') === 0 && /migraine|insomnia|sleep/i.test(hay)) ||
                  (group.indexOf('Skin') === 0 && /eczema|psorias|allerg/i.test(hay)) ||
                  (group.indexOf('Kidney') === 0 && /kidney|uti|prostate/i.test(hay));
                if (!hit) continue;
                await Storage.saveAdvice({
                  patientId: p.id, doctorId: session.id, doctorName: session.name,
                  template: 'Broadcast · ' + group, text: text, status: 'sent', broadcast: true
                });
                n++;
              }
              await Storage.saveAuditLog({
                actorId: session.id, actorRole: session.role, action: 'advice.broadcast',
                patientId: null, message: 'Broadcast to ' + group + ' reached ' + n + ' demo patient(s).'
              });
              App.toast('Broadcast stored for ' + n + ' patient(s) (local demo).', 'success');
              return true;
            }
          }
        ]
      });
    });

    document.getElementById('auditBtn').addEventListener('click', async function () {
      var rows = await Storage.getAuditLog();
      var body = document.createElement('div');
      body.innerHTML = '<p class="small">' + rows.length + ' local audit entries (newest first). Nothing leaves this browser.</p>' +
        '<div class="table-wrap" style="max-height:50vh;overflow:auto"><table class="tbl"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Message</th></tr></thead><tbody>' +
        (rows.length ? rows.slice(0, 100).map(function (e) {
          return '<tr><td class="small">' + App.esc(App.fmtDate(e.timestamp)) + '<br>' + App.esc(App.fmtTime(e.timestamp)) + '</td>' +
            '<td class="small">' + App.esc(e.actorRole) + '<br>' + App.esc(e.actorId) + '</td>' +
            '<td class="small">' + App.esc(e.action) + (e.patientId ? '<br>' + App.esc(e.patientId) : '') + '</td>' +
            '<td class="small">' + App.esc(e.message || '') + '</td></tr>';
        }).join('') : '<tr><td colspan="4" class="empty">No audit entries yet.</td></tr>') +
        '</tbody></table></div>';
      App.modal({ title: 'Audit log', bodyNode: body, actions: [{ label: 'Close', value: true, primary: true }] });
    });

    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-test]') : null;
      if (b) App.triggerDemoEvent(b.getAttribute('data-test'));
    });
  }

  /* ------------------------------------------------------------- login */
  function showLogin() {
    document.getElementById('login').hidden = false;
    document.getElementById('board').hidden = true;
    document.getElementById('lockBtn').hidden = true;
    document.getElementById('logoutBtn').hidden = true;

    var wa = document.getElementById('webauthnLine');
    if (!Auth.supportsWebAuthn()) {
      wa.textContent = 'WebAuthn is not available in this browser. PIN sign-in remains available for the demo.';
    } else {
      Auth.platformAuthenticatorAvailable().then(function (ok) {
        wa.textContent = 'WebAuthn: supported. Platform authenticator (biometric / passkey): ' + (ok ? 'available' : 'not available') +
          '. Stored demo passkey: ' + (Auth.hasPasskey() ? 'yes' : 'no') + '. "Passkey verified" is only ever shown after a real assertion.';
      });
    }

    document.getElementById('roleSel').addEventListener('change', function (e) {
      var nurse = e.target.value === 'nurse';
      document.getElementById('loginId').value = nurse ? 'NUR-1001' : 'DOC-1001';
      document.getElementById('loginPin').value = nurse ? '5678' : '1234';
    });

    document.getElementById('passkeyBtn').addEventListener('click', async function () {
      var out = document.getElementById('loginMsg');
      out.textContent = 'Waiting for the browser passkey prompt…';
      try {
        if (!Auth.hasPasskey()) await Auth.registerPasskey('DOC-1001');
        await Auth.loginWithPasskey();
        out.textContent = 'Passkey verified — real WebAuthn assertion succeeded. Now sign in with the demo PIN to choose a role.';
        App.toast('WebAuthn assertion succeeded.', 'success');
      } catch (e) {
        out.textContent = 'Passkey not completed: ' + (e && e.message ? e.message : 'cancelled') + '. PIN fallback stays available (demo).';
        App.toast('WebAuthn not completed — use the demo PIN.', 'warning');
      }
    });

    document.getElementById('loginForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var id = document.getElementById('loginId').value;
      var pin = document.getElementById('loginPin').value;
      var res = await Auth.loginStaff(id, pin);
      if (!res.ok) { document.getElementById('loginMsg').textContent = res.message; App.toast(res.message, 'error'); return; }
      session = Auth.current();
      enterBoard();
    });
  }

  async function enterBoard() {
    document.getElementById('login').hidden = true;
    document.getElementById('board').hidden = false;
    document.getElementById('lockBtn').hidden = false;
    document.getElementById('logoutBtn').hidden = false;
    document.getElementById('brandStaff').textContent = session.name + ' · ' + session.role + ' (' + session.id + ')';
    document.getElementById('boardTitle').textContent = (session.role === 'nurse' ? 'Nurse' : 'Doctor') + ' triage board';
    await renderBoard();
    Auth.startIdleWatch({
      onLock: function (auto) {
        Storage.clearSession();
        App.modal({
          title: 'Locked',
          body: (auto ? 'Auto-locked after inactivity (demo policy).' : 'Session locked.') +
            '\n\nA qualified healthcare professional must make clinical decisions. Demo for education only, not medical advice.',
          blockEscape: true,
          actions: [{ label: 'Sign in again', value: true, primary: true }]
        }).then(function () { location.reload(); });
      }
    });
  }

  document.getElementById('lockBtn').addEventListener('click', function () { Auth.lockNow(); });

  /* -------------------------------------------------------------- boot */
  App.boot('doctor').then(function () {
    Sync.init();
    bindBoard();
    session = Auth.current();
    if (!session || (session.role !== 'doctor' && session.role !== 'nurse')) {
      showLogin();
    } else {
      return enterBoard();
    }
  }).then(function () {
    App.DemoFlow.continueOnLoad('doctor');
  }).catch(function (e) {
    console.error(e);
    App.toast('Doctor dashboard could not fully initialise: ' + (e && e.message ? e.message : ''), 'error');
    showLogin();
  });

  document.addEventListener('vpdt:demoStep', function (e) {
    var step = e.detail && e.detail.step;
    if (step >= 4 && step <= 8 && !session) return;
    if (step >= 4 && step <= 8) {
      if (step === 4) {
        App.toast('Alert for PT-1004 is visible in the triage list below.', 'info');
      }
      openDetail('PT-1004');
      setTimeout(function () {
        if (step >= 7) {
          var d = document.getElementById('draft');
          if (d) d.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        if (step === 8) {
          var b = document.getElementById('approveBtn');
          if (b) { b.classList.add('btn-warn'); b.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        }
      }, 400);
    }
  });

  document.addEventListener('vpdt:data', function () { if (session) renderBoard(); });
})();
