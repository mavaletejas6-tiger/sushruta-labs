/*
 * caregiver.js - consent-gated, data-minimised caregiver view.
 *                Only medicines, appointments, emergency alerts and basic
 *                wellness are shown, and only while the patient keeps
 *                caregiver sharing enabled.
 *
 * Demo for education only, not medical advice.
 */
(function () {
  'use strict';

  function when(o) {
    if (!o) return '-';
    if (o.date) return App.fmtDate(o.date);
    if (o.timestamp) return App.fmtDate(o.timestamp);
    if (typeof o.daysAgo === 'number') return App.fmtDate(DemoData.dateFromDaysAgo(o.daysAgo));
    if (typeof o.daysAhead === 'number') return App.fmtDate(DemoData.dateFromDaysAhead(o.daysAhead));
    return '-';
  }

  function sharingOn(p) {
    return !!(p.consent && p.consent.given && p.consent.items && p.consent.items.caregiverSharing);
  }

  function denied(p, why) {
    var host = document.getElementById('cout');
    if (!host) return;
    host.innerHTML =
      '<div class="info-box"><strong>⛔ Access not available</strong><p class="small">' + App.esc(why) + '</p>' +
      '<p class="small">The patient controls this from Patient dashboard → Settings → Consent. This page never shows hidden data.</p></div>';
    Storage.saveAuditLog({
      actorId: 'caregiver', actorRole: 'caregiver', action: 'access.denied', patientId: p ? p.id : null,
      message: 'Caregiver view blocked: ' + why
    });
  }
  function telHrefSafe(phone) {
    var raw = String(phone || '').trim();
    if (!raw) return '';
    var digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    return 'tel:' + (raw.charAt(0) === '+' ? '+' : '') + digits;
  }
  function copyCgText(value, label) {
    var v = String(value || '').trim();
    if (!v) { App.toast('Nothing to copy yet.', 'error'); return; }
    function done() { App.toast((label || 'Value') + ' copied to clipboard (demo).', 'success'); }
    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = v;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { App.toast('Copy failed — select and copy manually.', 'error'); }
        document.body.removeChild(ta);
      } catch (e) { App.toast('Copy failed — select and copy manually.', 'error'); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, fallback);
    else fallback();
  }

  async function openView() {
    var pid = document.getElementById('cpid').value;
    var p = await Storage.getPatient(pid);
    if (!p) { denied(null, 'That demo patient no longer exists in local storage.'); return; }
    if (p.deceased) { denied(p, 'This record is archived as deceased; caregiver access is closed.'); return; }
    if (!p.consent || !p.consent.given) { denied(p, 'The patient has not given demo consent yet.'); return; }
    if (!sharingOn(p)) { denied(p, 'Caregiver sharing is switched OFF for ' + p.name + '.'); return; }

    var r = Risk.assess(p, {});
    var d = (p.wearableData || []).slice(-1)[0] || {};
    var alerts = (await Storage.getAlerts(p.id)).concat(p.alerts || []);
    var red = alerts.filter(function (a) { return a.level === 'red'; }).slice().reverse();
    var cg = p.consent.caregiver || {};

    await Storage.saveAuditLog({
      actorId: 'caregiver', actorRole: 'caregiver', action: 'access.granted', patientId: p.id,
      message: 'Caregiver viewed the limited (consented) summary for ' + p.id + '.'
    });

    document.getElementById('cout').innerHTML =
      '<div class="info-box"><strong>✅ Sharing is on for ' + App.esc(p.name) + '</strong>' +
      '<p class="small">Scope: ' + App.esc((cg.scope || ['medicines', 'appointments', 'alerts', 'wellness']).join(', ')) +
      (cg.relation ? ' · relation: ' + App.esc(cg.relation) : '') +
      ' · status: ' + App.esc(p.status || 'active') + '</p>' +
      '<p class="fineprint">Labs, full history, payments and private notes stay hidden (data minimisation).</p></div>' +

      '<div class="grid grid-2">' +
      '<section class="card"><h3>💊 Medicine schedule</h3>' +
      ((p.medicines || []).length
        ? '<ul class="list">' + p.medicines.map(function (m) {
          return '<li><div class="li-main"><span class="li-title">' + App.esc(m.name) + ' ' + App.esc(m.dose) + '</span>' +
            '<span class="li-sub">📅 ' + App.esc(App.medDateRange(m)) + ' · 🔁 ' + App.esc(App.medSchedule(m)) + '</span>' +
            '<span class="li-sub">🕐 ' + App.esc(App.medTimes(m) || 'no fixed time') + (App.medFrequency(m) ? ' · ' + App.esc(App.medFrequency(m)) : '') + (m.instructions ? ' — ' + App.esc(m.instructions) : '') + '</span></div>' +
            '<span class="tag">' + App.esc(m.condition || '') + '</span></li>';
        }).join('') + '</ul>'
        : '<p class="empty">No medicines scheduled.</p>') +
      '<p class="fineprint">Adherence (7-day demo log): ' + ((p.adherence || {}).percent || 0) + '% · ' +
      App.esc(((p.adherence || {}).last7 || []).join(', ') || 'no recent entries') + '</p></section>' +

      '<section class="card"><h3>📅 Appointments</h3>' +
      ((p.appointments || []).length
        ? '<ul class="list">' + p.appointments.map(function (a) {
          return '<li><div class="li-main"><span class="li-title">' + App.esc(when(a)) + ' · ' + App.esc(a.time || '') + '</span>' +
            '<span class="li-sub">' + App.esc(a.department || 'General Medicine') + ' · ' + App.esc(a.doctor || '') + ' · ' + App.esc(a.mode || 'clinic') + '</span></div>' +
            '<span class="tag">' + App.esc(a.status || 'booked') + '</span></li>';
        }).join('') + '</ul>'
        : '<p class="empty">No appointments booked in the demo.</p>') +
      '<p class="fineprint">Medicine reminders and appointment times are demo data only.</p></section>' +

      '<section class="card"><h3>🟢 Basic wellness</h3>' +
      '<div class="pc-metrics">' +
      '<div class="pc-metric"><b>' + (r.wellness ? r.wellness.score : '-') + '/100</b>wellness (demo)</div>' +
      '<div class="pc-metric"><b>' + App.esc(String(d.steps || '-')) + '</b>steps today</div>' +
      '<div class="pc-metric"><b>' + App.esc(String(d.sleepHours || '-')) + 'h</b>sleep</div>' +
      '<div class="pc-metric"><b>' + App.esc(String(d.heartRate || '-')) + '</b>heart rate bpm</div>' +
      '</div>' +
      '<p class="fineprint">Demo status: ' + App.esc(r.levelLabel) + ' — a rule-based demo label, not a diagnosis or medical advice.</p></section>' +

      '<section class="card" id="cgContactCard"><h3>📞 Emergency contact (read-only)</h3>' +
      (function () {
        var ph = String(p.phone || '').trim();
        var em = String(p.emergencyContact || '').trim();
        var phHref = telHrefSafe(ph);
        var emHref = telHrefSafe(em);
        var rows = '';
        rows += '<div class="li-main" style="margin-bottom:.5rem"><span class="li-title">Patient phone</span><br>' +
          (ph && phHref
            ? '<a class="mono" href="' + App.esc(phHref) + '">' + App.esc(ph) + '</a> ' +
              '<span class="btn-row" style="display:inline-flex;margin:.3rem 0 0"><a class="btn btn-ghost btn-sm" href="' + App.esc(phHref) + '" data-cg-call="phone">Call</a>' +
              '<button type="button" class="btn btn-ghost btn-sm" data-cg-copy="phone">Copy</button>' +
              '<button type="button" class="btn btn-ghost btn-sm" data-cg-sms="phone">SMS (demo)</button></span>'
            : '<span class="muted">not recorded</span>') + '</div>';
        rows += '<div class="li-main"><span class="li-title">Emergency contact</span><br>' +
          (em && emHref
            ? '<a class="mono" href="' + App.esc(emHref) + '">' + App.esc(em) + '</a> ' +
              '<span class="btn-row" style="display:inline-flex;margin:.3rem 0 0"><a class="btn btn-ghost btn-sm" href="' + App.esc(emHref) + '" data-cg-call="emg">Call</a>' +
              '<button type="button" class="btn btn-ghost btn-sm" data-cg-copy="emg">Copy</button>' +
              '<button type="button" class="btn btn-ghost btn-sm" data-cg-sms="emg">SMS (demo)</button></span>'
            : '<span class="muted">not recorded</span>') + '</div>';
        return rows;
      })() +
      '<p class="fineprint">Read-only for caregivers. To change these, the patient edits Settings → My contact. Call uses <span class="mono">tel:</span> (mobile dials, desktop may need Copy). SMS is simulated — no real message is sent.</p></section>' +

      '<section class="card"><h3>🚨 Emergency alerts</h3>' +
      (red.length
        ? '<ul class="list">' + red.map(function (a) {
          return '<li><div class="li-main"><span class="li-title">' + App.esc(a.title) + '</span>' +
            '<span class="li-sub">' + App.esc(a.reason || '') + '</span>' +
            '<span class="li-sub">' + App.esc(when(a)) + ' · ' + App.esc(a.status || 'open') + '</span></div>' +
            '<span class="tag" style="background:var(--red-bg);color:var(--red)">RED</span></li>';
        }).join('') + '</ul>'
        : '<p class="empty">No red alerts right now.</p>') +
      '<p class="fineprint">In a real emergency contact local emergency services and a qualified healthcare professional. This demo sends no real SMS or call.</p>' +
      '<div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" id="refreshBtn">Refresh view</button>' +
      '<a class="btn btn-ghost btn-sm" href="patient.html">Open patient app</a></div></section>' +
      '</div>';

    document.getElementById('refreshBtn').addEventListener('click', openView);
    // Caregiver contact actions: Call keeps native tel: href; Copy/SMS are demo-local.
    (function bindCgContact() {
      function valOf(which) {
        return which === 'emg' ? String(p.emergencyContact || '').trim() : String(p.phone || '').trim();
      }
      document.querySelectorAll('[data-cg-copy]').forEach(function (b) {
        b.addEventListener('click', function () {
          copyCgText(valOf(b.getAttribute('data-cg-copy')), b.getAttribute('data-cg-copy') === 'emg' ? 'Emergency contact' : 'Phone number');
        });
      });
      document.querySelectorAll('[data-cg-sms]').forEach(function (b) {
        b.addEventListener('click', function () {
          var v = valOf(b.getAttribute('data-cg-sms'));
          if (!v) { App.toast('No number to message yet.', 'error'); return; }
          if (!/^[\d+\-\s()]{7,20}$/.test(v) || v.replace(/\D/g, '').length < 7) { App.toast('Number looks invalid for demo SMS.', 'error'); return; }
          App.toast('Demo SMS simulated to ' + v + ' — no real message sent.', 'success');
        });
      });
      document.querySelectorAll('[data-cg-call]').forEach(function (a) {
        a.addEventListener('click', function () {
          App.toast('Dialling ' + valOf(a.getAttribute('data-cg-call')) + ' via tel: link (demo).', 'info');
        });
      });
    })();
  }

  async function boot() {
    var box = document.getElementById('box');
    var list = await Storage.getAllPatients();
    var active = list.filter(function (p) { return (p.status || 'active') !== 'archived'; });
    box.innerHTML =
      '<section class="card"><div class="card-title"><h1>Caregiver access (demo)</h1><span class="tag tag-syn">SYNTHETIC DEMO DATA</span></div>' +
      '<p class="card-sub">You only ever see the medicine schedule, appointments, emergency alerts and basic wellness — and only while the patient keeps caregiver sharing switched on. Labs, full history and private notes stay hidden by design.</p>' +
      '<div class="filter-bar">' +
      '<div class="field" style="flex:2 1 240px"><label for="cpid">Patient</label><select id="cpid">' +
      active.map(function (p) {
        return '<option value="' + App.esc(p.id) + '">' + App.esc(p.id) + ' — ' + App.esc(p.name) +
          (sharingOn(p) ? ' (sharing on)' : ' (sharing off)') + '</option>';
      }).join('') +
      '</select></div>' +
      '<div class="field" style="flex:0 0 auto"><label>&nbsp;</label><button type="button" class="btn btn-primary" id="cgo">View (checks consent)</button></div>' +
      '</div>' +
      '<p class="fineprint" id="consentLine"></p>' +
      '<div id="cout" style="margin-top:1rem"></div></section>';

    document.getElementById('cgo').addEventListener('click', openView);
    document.getElementById('cpid').addEventListener('change', function () {
      document.getElementById('cout').innerHTML = '';
    });
    updateConsentLine();
    document.getElementById('cpid').addEventListener('change', updateConsentLine);
  }

  async function updateConsentLine() {
    var el = document.getElementById('consentLine');
    if (!el) return;
    var p = await Storage.getPatient(document.getElementById('cpid').value);
    if (!p) { el.textContent = ''; return; }
    el.textContent = sharingOn(p)
      ? 'Consent state: caregiver sharing ON (patient-controlled). Every open is written to the local audit log.'
      : 'Consent state: caregiver sharing OFF — the view will stay empty until the patient enables it in Settings.';
  }

  App.boot('caregiver').then(function () {
    Sync.init();
    return boot();
  }).catch(function (e) {
    console.error(e);
    App.toast('Caregiver page could not fully initialise: ' + (e && e.message ? e.message : ''), 'error');
  });
})();
