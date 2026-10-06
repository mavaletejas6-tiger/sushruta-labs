/*
 * patient.js - patient application: login gate, onboarding, consent,
 *              dashboard, medicines, timeline,
 *              history, assistant, settings, SOS.
 *
 * Demo for education only, not medical advice.
 */
(function () {
  'use strict';

  var P = null;                 // active patient record
  var state = {
    view: 'dashboard',
    chartDays: 7,
    currentMed: null,
    speakAnswers: false,
    histFilter: 'all',
    ready: false,
    calYear: null,
    calMonth: null,
    calSelected: null
  };

  /* ================================================================ gate */
  function show(which) {
    ['loginCard', 'onboardCard', 'consentCard'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = (id !== which);
    });
    document.getElementById('gate').hidden = !which;
    document.getElementById('app').hidden = !!which;
    document.getElementById('logoutBtn').hidden = !!which;
    document.querySelector('.bottomnav').style.display = which ? 'none' : '';
    document.querySelector('.sidebar').hidden = !!which;
  }

  async function afterLogin() {
    var s = Auth.current();
    if (!s || s.role !== 'patient') { show('loginCard'); return; }
    var p = await Storage.getPatient(s.id);
    if (!p) { Auth.logout('Patient record not found.'); return; }
    if (Storage.getSetting('pendingOnboarding', false)) {
      startOnboarding(p, true);
      return;
    }
    if (!p.consent || !p.consent.given) { startConsent(p); return; }
    enterApp(p);
  }

  function enterApp(p) {
    P = p;
    state.ready = true;
    show(null);
    App.applyI18n();
    renderAll();
    if (Storage.getSetting('remindersEnabled', false)) {
      Notify.enable(p.id);
    }
    document.dispatchEvent(new CustomEvent('vpdt:patient', { detail: p }));
  }

  /* ---------------------------------------------------------- login form */
  function bindLogin() {
    document.getElementById('loginForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var id = document.getElementById('loginId').value.trim();
      var res = await Auth.loginPatient(id);
      var msg = document.getElementById('loginMsg');
      if (!res.ok) { msg.textContent = res.message; return; }
      msg.textContent = '';
      afterLogin();
    });
    document.getElementById('loginListBtn').addEventListener('click', async function () {
      var patients = await Storage.getAllPatients();
      var body = document.createElement('div');
      body.innerHTML = '<p class="small">SYNTHETIC DEMO DATA — no password in demo mode.</p><ul class="list">' +
        patients.filter(function (x) { return (x.status || 'active') !== 'archived'; }).map(function (x) {
          return '<li><div class="li-main"><span class="li-title">' + App.esc(x.name) + '</span> ' +
            '<span class="li-sub mono">' + App.esc(x.id) + ' · ' + App.esc(x.condition || '') + '</span></div>' +
            '<button type="button" class="btn btn-primary btn-sm" data-open="' + App.esc(x.id) + '">Open</button></li>';
        }).join('') + '</ul>';
      App.modal({ title: 'Demo patients', bodyNode: body, actions: [{ label: 'Close', value: false }] });
      body.addEventListener('click', async function (e2) {
        var b = e2.target.closest('[data-open]');
        if (!b) return;
        var res = await Auth.loginPatient(b.getAttribute('data-open'));
        if (res.ok) afterLogin();
      });
    });
    var newBtn = document.getElementById('newPatientBtn');
    if (newBtn) {
      newBtn.addEventListener('click', async function () {
        var patients = await Storage.getAllPatients();
        var id = nextPatientId(patients);
        var p = buildNewPatient(id);
        await Storage.savePatient(p);
        Auth.createSession({ role: 'patient', id: p.id, name: p.name, method: 'onboarding' });
        Storage.setSetting('currentPatientId', p.id);
        Storage.setSetting('pendingOnboarding', true);
        App.toast('New patient number assigned: ' + id + ' (sequential, not random).', 'success');
        afterLogin();
      });
    }
    document.getElementById('obCancel').addEventListener('click', function () {
      Storage.removeSetting('pendingOnboarding');
      Auth.logout('Onboarding cancelled.');
    });
  }

  function defaultProfile() {
    return { scenario: 'new', restingHR: 72, hrv: 40, steps: 6000, sleep: 7, sleepQuality: 70, spo2: 98, systolic: 122, diastolic: 78, sugar: 100, rr: 16, stress: 40, trend: 'stable' };
  }
  /* Sequential patient numbers: PT-1001, PT-1002, … — never random.
   * Finds the highest numeric suffix already stored and adds 1,
   * skipping any collision (e.g. after archive/delete). */
  function nextPatientId(patients) {
    var max = 1010;
    (patients || []).forEach(function (x) {
      var m = String(x && x.id || '').match(/^PT-(\d{3,6})$/i);
      if (m) {
        var n = parseInt(m[1], 10);
        if (!isNaN(n) && n > max) max = n;
      }
    });
    var candidate = max + 1;
    var ids = {};
    (patients || []).forEach(function (x) { if (x && x.id) ids[String(x.id).toUpperCase()] = true; });
    while (ids['PT-' + candidate]) candidate++;
    return 'PT-' + candidate;
  }
  function isValidPhone(v) {
    var d = String(v || '').replace(/\D/g, '');
    return d.length >= 7 && d.length <= 15;
  }
  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
  }
  function buildNewPatient(id) {
    var profile = defaultProfile();
    var series = DemoData.generateSeries(id, profile);
    return {
      id: id, name: 'New Demo Patient', age: 40, gender: 'Female', bloodGroup: '-',
      phone: '', email: String(id).toLowerCase() + '@demo.local', emergencyContact: '', language: 'en', wakePhrase: 'help me assistant 3056',
      allergies: [], diagnosis: [], condition: 'Stable', labs: {}, medicines: [], visits: [],
      appointments: [], payments: [], doctorNotes: [], advice: [], alerts: [],
      timeline: [{ day: 1, title: 'Registration', detail: 'Patient registered in the demo system.', type: 'info' }],
      treatment: { condition: '-', startDaysAgo: 0, status: 'ongoing', summary: [] },
      wearableProfile: profile, wearableData: series,
      adherence: { percent: 100, last7: [] },
      consent: { given: false, items: {}, caregiver: { granted: false, scope: [] } },
      status: 'active', synthetic: true
    };
  }

  /* --------------------------------------------------------- onboarding */
  function startOnboarding(p, prefill) {
    P = p || P;
    show('onboardCard');
    var pidEl = document.getElementById('obPatientId');
    if (pidEl && P) pidEl.textContent = P.id || '—';
    if (prefill && p) {
      document.getElementById('obName').value = (p.name && p.name !== 'New Demo Patient') ? p.name : '';
      document.getElementById('obAge').value = p.age || '';
      document.getElementById('obGender').value = p.gender || 'Female';
      document.getElementById('obBlood').value = (p.bloodGroup && p.bloodGroup !== '-') ? p.bloodGroup : '';
      document.getElementById('obPhone').value = p.phone || '';
      var emEl = document.getElementById('obEmail');
      if (emEl) emEl.value = p.email || '';
      document.getElementById('obEmergency').value = p.emergencyContact || '';
      document.getElementById('obLang').value = p.language || 'en';
      document.getElementById('obWake').value = p.wakePhrase || 'help me assistant 3056';
    }
    document.getElementById('onboardForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var name = document.getElementById('obName').value.trim();
      var age = parseInt(document.getElementById('obAge').value, 10);
      var phone = document.getElementById('obPhone').value.trim();
      var emailEl = document.getElementById('obEmail');
      var email = emailEl ? emailEl.value.trim().toLowerCase() : '';
      var emergency = document.getElementById('obEmergency').value.trim();
      if (!name) { App.toast('Please enter a name.', 'error'); return; }
      if (!(age >= 1 && age <= 120)) { App.toast('Please enter an age between 1 and 120.', 'error'); return; }
      if (!phone) { App.toast('Phone number is required for registration.', 'error'); document.getElementById('obPhone').focus(); return; }
      if (!isValidPhone(phone)) { App.toast('Phone looks invalid — use 7–15 digits, e.g. +91-9000000001.', 'error'); document.getElementById('obPhone').focus(); return; }
      if (!email) { App.toast('Email address is required for registration.', 'error'); if (emailEl) emailEl.focus(); return; }
      if (!isValidEmail(email)) { App.toast('Email looks invalid — expected name@example.com.', 'error'); if (emailEl) emailEl.focus(); return; }
      if (emergency && !isValidPhone(emergency)) { App.toast('Emergency contact looks invalid — use 7–15 digits or leave it empty.', 'error'); return; }
      if (emergency && emergency === phone) { App.toast('Phone and emergency contact should be different numbers.', 'error'); return; }
      var patch = {
        name: name, age: age,
        gender: document.getElementById('obGender').value,
        bloodGroup: document.getElementById('obBlood').value.trim() || '-',
        allergies: document.getElementById('obAllergies').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
        phone: phone,
        email: email,
        emergencyContact: emergency,
        language: document.getElementById('obLang').value,
        wakePhrase: document.getElementById('obWake').value.trim() || 'help me assistant 3056'
      };
      var targetId = (P && P.id) || (Auth.current() && Auth.current().id);
      await Storage.updatePatient(targetId, patch);
      Storage.removeSetting('pendingOnboarding');
      App.setLanguage(patch.language);
      var fresh = await Storage.getPatient(targetId);
      if (!fresh) fresh = await Storage.getPatient(Auth.current().id);
      await Storage.saveAuditLog({ actorId: fresh.id, actorRole: 'patient', action: 'onboarding.completed', patientId: fresh.id, message: 'Onboarding details saved for ' + fresh.id + ' — phone ' + patch.phone + ', email ' + patch.email + ' (demo, local only).' });
      startConsent(fresh);
    }, { once: true });
  }

  /* ------------------------------------------------------------- consent */
  function startConsent(p) {
    P = p;
    show('consentCard');
    document.getElementById('consentMsg').textContent = '';
    document.getElementById('consentForm').addEventListener('submit', onAccept, { once: true });
    document.getElementById('consentDecline').addEventListener('click', async function () {
      App.modal({
        title: 'Consent declined',
        body: 'You declined consent, so the patient dashboard cannot continue.\n\nYou can review the information and try again at any time.\n\nDemo for education only, not medical advice.',
        actions: [{ label: 'Review consent again', value: 'again', primary: true }, { label: 'Go back home', value: 'home' }]
      }).then(function (r) {
        if (r === 'again') startConsent(P);
        else window.location.href = 'index.html';
      });
    }, { once: true });

    async function onAccept(e) {
      e.preventDefault();
      if (!document.getElementById('cData').checked) {
        document.getElementById('consentMsg').textContent = 'You must accept the required data-storage consent to continue.';
        return;
      }
      var items = {
        dataCollection: true,
        doctorSharing: document.getElementById('cDoctor').checked,
        caregiverSharing: document.getElementById('cCaregiver').checked,
        microphone: document.getElementById('cMic').checked,
        notifications: document.getElementById('cNotif').checked,
        aiFeatures: document.getElementById('cAi').checked,
        caregiverAccess: document.getElementById('cCaregiver').checked
      };
      var p = await Storage.getPatient(P.id);
      p.consent = {
        given: true, date: DemoData.dateFromDaysAgo(0), items: items,
        caregiver: p.consent && p.consent.caregiver ? p.consent.caregiver : { name: '', phone: '', relation: '', granted: items.caregiverAccess, scope: ['medicines', 'appointments', 'alerts', 'wellness'] }
      };
      p.consent.caregiver.granted = items.caregiverAccess;
      await Storage.savePatient(p);
      await Storage.saveAuditLog({ actorId: p.id, actorRole: 'patient', action: 'consent.accepted', patientId: p.id, message: 'Patient accepted demo consent: ' + Object.keys(items).filter(function (k) { return items[k]; }).join(', ') });
      App.toast('Welcome, ' + p.name, 'success');
      enterApp(p);
    }
  }

  /* ============================================================== render */
  function renderAll() {
    if (!P) return;
    renderDashboard();
    renderMeds();
    renderTimeline();
    renderHistory();
    renderSettings();
    renderCalendar();
    updateBrand();
  }

  function updateBrand() {
    var el = document.getElementById('brandPatient');
    if (el && P) el.textContent = P.name + ' · ' + P.id;
  }

  function todayVitals(p) { return DemoData.todayVitals(p) || {}; }
  function seriesFor(p, days) {
    if (!p.wearableData) return [];
    if (days <= p.wearableData.length) return p.wearableData.slice(p.wearableData.length - days);
    var out = [];
    var need = Math.ceil((days - p.wearableData.length) / 30);
    for (var k = need; k >= 1; k--) {
      var ext = DemoData.generateSeries(p.id + '-ext' + k, p.wearableProfile || {});
      ext.forEach(function (r) { r.daysAgo = r.daysAgo + 30 * k; r.date = DemoData.dateFromDaysAgo(r.daysAgo); });
      out = out.concat(ext);
    }
    return out.concat(p.wearableData);
  }

  /* ---------------------------------------------------------- dashboard */
  function renderDashboard() {
    if (!P) return;
    document.getElementById('greeting').textContent = App.greeting() + ',';
    document.getElementById('dashTitle').textContent = 'Welcome, ' + P.name;

    var risk = Risk.assess(P, {});
    document.getElementById('dashRiskBadge').innerHTML = App.riskBadge(risk.level, risk.levelLabel);

    var w = risk.wellness;
    document.getElementById('wellnessLabel').textContent = 'Wellness Score ' + w.score + '/100';
    App.gauge(document.getElementById('wellnessGauge'), w.score);

    var t = todayVitals(P) || {};
    var sleepEl = document.getElementById('stSleep');
    if (sleepEl) {
      sleepEl.innerHTML = (t.sleepHours || '–') + ' <small>h</small>';
      if (sleepEl.nextElementSibling) sleepEl.nextElementSibling.textContent = 'hours · quality ' + (t.sleepQuality || '–');
    }
    var adhEl = document.getElementById('stAdh');
    if (adhEl) adhEl.innerHTML = ((P.adherence && P.adherence.percent) || 0) + '<small>%</small>';

    var apt = (P.appointments || []).filter(function (a) { return a.status !== 'cancelled'; })
      .sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); })[0];
    if (apt) {
      document.getElementById('stApt').textContent = App.fmtDate(apt.date) + ', ' + apt.time;
      document.getElementById('stAptFoot').textContent = apt.department + ' · ' + apt.doctor + (apt.mode ? ' · ' + apt.mode : '');
    } else {
      document.getElementById('stApt').textContent = 'None scheduled';
      document.getElementById('stAptFoot').textContent = 'Book from the advice card';
    }

    // explainable risk
    var box = document.getElementById('riskExplain');
    var html = '<p><strong>Risk score: ' + risk.score + '/100</strong> ' + App.riskBadge(risk.level, risk.levelLabel) + '</p>';
    html += '<p class="small"><strong>Contributing factors:</strong></p><ul class="small">';
    risk.reasons.slice(0, 7).forEach(function (r) { html += '<li>' + App.esc(r) + '</li>'; });
    html += '</ul><p class="small"><strong>Demo recommendation:</strong> ' + App.esc(risk.suggestedActions[0] || '') + '</p>';
    html += '<details class="disclosure"><summary>Wellness score breakdown (demo)</summary><ul class="small">' +
      w.factors.map(function (f) { return '<li>' + App.esc(f.label) + ': ' + App.esc(String(f.raw)) + ' → ' + f.normalized + '/100</li>'; }).join('') +
      '</ul><p class="fineprint">' + App.esc(w.note) + '</p></details>';
    html += '<p class="fineprint">' + App.esc(risk.disclaimer) + '</p>';
    box.innerHTML = html;

    // alerts
    var alerts = (P.alerts || []).slice().sort(function (a, b) { return String(b.timestamp || '').localeCompare(String(a.timestamp || '')); });
    var al = document.getElementById('alertList');
    al.innerHTML = alerts.length ? alerts.map(function (a) {
      return '<li><div class="li-main">' +
        '<div class="li-title">' + App.esc(a.title) + '</div>' +
        '<div class="li-sub">' + App.esc(a.reason || '') + '</div>' +
        '<div class="li-sub">Suggested action: ' + App.esc(a.action || '') + '</div>' +
        '<span class="tag tag-syn">SYNTHETIC DEMO ALERT</span> <span class="small">' + App.esc(App.fmtDate(a.timestamp)) + '</span>' +
        '</div><div>' + App.riskBadge(a.level || 'yellow') + '</div></li>';
    }).join('') : '<li class="empty">No synthetic alerts right now.</li>';

    renderAdvice();
    renderDashMeds();
    renderContinuity();
    renderAbdm();
    renderCharts();
  }

  /* ---------------- Continuity of Care (patient view: follow-ups + previous instructions) */
  function renderContinuity() {
    if (!P || !window.Clinical) return;
    var fuHost = document.getElementById('followUpList');
    var inHost = document.getElementById('prevInstrList');
    if (!fuHost && !inHost) return;
    var all = Clinical.getFollowUps(P);
    var pending = Clinical.pendingFollowUps(P);
    if (fuHost) {
      fuHost.innerHTML = all.length ? all.slice().reverse().slice(0, 8).map(function (f) {
        var done = (f.status || 'open') !== 'open';
        return '<li><div class="li-main">' +
          '<div class="li-title">' + (done ? '✅ ' : '📌 ') + App.esc(f.title) + ' <span class="tag">' + App.esc(f.status || 'open') + '</span></div>' +
          '<div class="li-sub">Due: ' + App.esc(f.dueDate ? App.fmtDate(f.dueDate) : 'no date') + (f.detail ? ' — ' + App.esc(f.detail) : '') + '</div>' +
          '<div class="li-sub small muted">' + App.esc(f.createdBy || 'care team') + '</div></div>' +
          (done ? '' : '<button type="button" class="btn btn-ghost btn-sm" data-fu-done="' + App.esc(f.id) + '">Mark done</button>') + '</li>';
      }).join('') : '<li class="empty">No follow-ups yet — your doctor adds them after a consultation.</li>';
      fuHost.querySelectorAll('[data-fu-done]').forEach(function (b) {
        b.onclick = async function () {
          var fid = b.getAttribute('data-fu-done');
          var fresh = await Storage.getPatient(P.id);
          if (!fresh) return;
          Clinical.getFollowUps(fresh).forEach(function (f) {
            if (f.id === fid && (f.status || 'open') === 'open') { f.status = 'done'; f.doneAt = new Date().toISOString(); }
          });
          await Storage.savePatient(fresh);
          P = fresh;
          renderContinuity(); renderHistory();
          App.toast('Follow-up marked done (local demo).', 'success');
        };
      });
    }
    if (inHost) {
      Storage.getAdvice(P.id).then(function (advice) {
        var prev = Clinical.getPreviousInstructions(P, advice);
        inHost.innerHTML = prev.length ? prev.slice(0, 5).map(function (x) {
          return '<li><div class="li-main"><div class="li-title">' + App.esc(x.title) + '</div>' +
            '<div class="li-sub">' + App.esc(String(x.detail || '').slice(0, 160)) + '</div>' +
            '<div class="li-sub small muted">' + App.esc(x.by || '') + ' · ' + App.esc(App.fmtDate(x.date)) + '</div></div></li>';
        }).join('') : '<li class="empty">No instructions yet.</li>';
      });
    }
    void pending;
  }

  /* ---------------- ABDM / ABHA (patient view: demo field + portable export) */
  function renderAbdm() {
    if (!P || !window.Clinical) return;
    var inp = document.getElementById('abhaInput');
    var st = document.getElementById('abhaStatus');
    if (!inp && !st) return;
    var abha = Clinical.getAbha(P);
    if (inp && document.activeElement !== inp) inp.value = abha.id || '';
    if (st) st.innerHTML = 'Status: ' + (abha.id ? 'demo-linked to <span class="mono">' + App.esc(abha.id) + '</span> (local demo only, NOT real ABDM)' : 'not linked (demo)');
    var save = document.getElementById('abhaSaveBtn');
    if (save && !save.dataset.bound) {
      save.dataset.bound = '1';
      save.addEventListener('click', async function () {
        var v = Clinical.normalizeAbha(document.getElementById('abhaInput').value);
        var err = Clinical.isValidAbha(v);
        var mEl = document.getElementById('abhaMsg');
        if (err) { if (mEl) mEl.textContent = err; App.toast(err, 'error'); return; }
        var fresh = await Storage.getPatient(P.id);
        if (!fresh) return;
        fresh.abha = { id: v, linked: true, consent: true, linkedAt: new Date().toISOString(), linkedBy: 'patient' };
        await Storage.savePatient(fresh);
        P = fresh; renderAbdm();
        if (mEl) mEl.textContent = '';
        App.toast('ABHA ID demo-linked locally (not real ABDM).', 'success');
      });
    }
    var un = document.getElementById('abhaUnlinkBtn');
    if (un && !un.dataset.bound) {
      un.dataset.bound = '1';
      un.addEventListener('click', async function () {
        var fresh = await Storage.getPatient(P.id);
        if (!fresh) return;
        fresh.abha = { id: '', linked: false, consent: false };
        await Storage.savePatient(fresh);
        P = fresh; renderAbdm();
        App.toast('ABHA demo-link removed.', 'info');
      });
    }
    var ex = document.getElementById('abdmExportBtn');
    if (ex && !ex.dataset.bound) {
      ex.dataset.bound = '1';
      ex.addEventListener('click', async function () {
        var advice = await Storage.getAdvice(P.id);
        Clinical.downloadAbdmRecord(P, { adviceList: advice });
        App.toast('ABDM-aligned demo record downloaded (JSON, local only).', 'success');
      });
    }
  }

  function renderAdvice() {
    var list = document.getElementById('adviceList');
    Storage.getAdvice(P.id).then(function (items) {
      if (!items.length) { list.innerHTML = '<li class="empty">No advice yet.</li>'; return; }
      list.innerHTML = items.map(function (a) {
        var unread = a.status !== 'read' && a.status !== 'understood';
        return '<li><div class="li-main">' +
          '<div class="li-title">' + (unread ? '📥 ' : '') + 'New advice from ' + App.esc(a.doctorName || 'your care team') + '</div>' +
          '<div class="li-sub">' + App.esc(a.template || '') + ' · ' + App.esc(App.fmtDate(a.timestamp)) + '</div>' +
          '<div class="li-sub status">' + App.esc(a.status || 'sent') + (a.aiDraft ? ' · AI draft approved by a human' : '') + '</div>' +
          '</div><div class="btn-row">' +
          '<button type="button" class="btn btn-primary btn-sm" data-read="' + App.esc(a.id) + '">' + App.t('readAdvice') + '</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-ack="' + App.esc(a.id) + '">' + App.t('markUnderstood') + '</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-book="1">' + App.t('bookConsult') + '</button>' +
          '</div></li>';
      }).join('');
    });
  }

  /* ------------------------------------------------------------- medicines */
  function medKey(medId, time) { return medId + '@' + time; }
  function todaysLogs() {
    var today = DemoData.dateFromDaysAgo(0);
    return Storage.getMedicationLogs(P.id).then(function (logs) {
      return logs.filter(function (l) {
        var d = new Date(l.actualTime);
        return !isNaN(d) && DemoData.dateFromDaysAgo(0) === d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      });
    });
  }

  function renderDashMeds() {
    var host = document.getElementById('dashMeds');
    var meds = (P.medicines || []).slice(0, 3);
    if (!meds.length) { host.innerHTML = '<p class="empty">No medicines added yet — your care team adds them from the doctor dashboard.</p>'; return; }
    host.innerHTML = '<ul class="list">' + meds.map(function (m) {
      return '<li><div class="li-main"><span class="li-title">' + App.esc(m.name) + ' ' + App.esc(m.dose) + '</span>' +
        '<span class="li-sub">🕐 ' + App.esc(App.medTimes(m) || 'no fixed time') + ' · ' + App.esc(App.medSchedule(m)) + '</span>' +
        '<span class="li-sub">' + App.esc(App.medDateRange(m)) + (m.instructions ? ' — ' + App.esc(m.instructions) : '') + '</span></div>' +
        '<button type="button" class="btn btn-primary btn-sm" data-taken="' + App.esc(m.id) + '">I took my medicine</button></li>';
    }).join('') + '</ul>';
  }

  async function renderMeds() {
    var host = document.getElementById('medList');
    var meds = P.medicines || [];
    if (!meds.length) {
      host.innerHTML = '<p class="empty">No medicines added yet. Your doctor adds your medicines from the care team dashboard.</p>';
    } else {
      var logs = await Storage.getMedicationLogs(P.id);
      var todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      var todayLogs = logs.filter(function (l) { return new Date(l.actualTime) >= todayStart; });
      host.innerHTML = meds.map(function (m) {
        var lg = todayLogs.filter(function (l) { return l.medicineId === m.id; });
        var last = lg[lg.length - 1];
        var cls = last ? last.status : '';
        var statusTxt = last ? (last.status.charAt(0).toUpperCase() + last.status.slice(1)) : 'Not logged yet';
        if (!state.currentMed && (!last || last.status !== 'taken')) state.currentMed = m;
        return '<article class="med-card ' + App.esc(cls) + '">' +
          '<div class="row-between"><div><div class="med-name">' + App.esc(m.name) + ' ' + App.esc(m.dose) + '</div>' +
          '<div class="med-meta">📅 ' + App.esc(App.medDateRange(m)) + ' · 🔁 ' + App.esc(App.medSchedule(m)) + '</div>' +
          '<div class="med-meta">🕐 ' + App.esc(App.medTimes(m) || 'no fixed time') + (App.medFrequency(m) ? ' · ' + App.esc(App.medFrequency(m)) : '') + (m.instructions ? ' — ' + App.esc(m.instructions) : '') + '</div></div>' +
          '<div class="med-status">' + App.esc(statusTxt) + '</div></div>' +
          '<div class="btn-row">' +
          '<button type="button" class="btn btn-primary btn-sm" data-log="taken" data-med="' + App.esc(m.id) + '">I took my medicine</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-log="missed" data-med="' + App.esc(m.id) + '">Missed</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-log="later" data-med="' + App.esc(m.id) + '">Remind me later</button>' +
          '</div></article>';
      }).join('');
    }
    // logs table
    var rows = await Storage.getMedicationLogs(P.id);
    rows.sort(function (a, b) { return String(b.actualTime).localeCompare(String(a.actualTime)); });
    var tbody = document.getElementById('medLogRows');
    if (!rows.length) tbody.innerHTML = '<tr><td colspan="6" class="empty">No entries yet.</td></tr>';
    else tbody.innerHTML = rows.slice(0, 25).map(function (l) {
      return '<tr><td>' + App.esc(l.medicineName || l.medicineId) + '</td><td>' + App.esc(String(l.scheduledTime || '-')) + '</td>' +
        '<td>' + App.esc(App.fmtTime(l.actualTime)) + ' ' + App.esc(App.fmtDate(l.actualTime)) + '</td>' +
        '<td>' + App.esc(l.status) + '</td><td>' + App.esc(l.source) + '</td><td>' + Math.round((l.confidence || 0) * 100) + '%</td></tr>';
    }).join('');
  }

  async function logMed(medId, status, source, confidence) {
    var m = (P.medicines || []).filter(function (x) { return x.id === medId; })[0];
    if (!m) return;
    if (status === 'later') {
      App.toast('Reminder snoozed for 10 minutes (demo).', 'info');
      setTimeout(function () { Notify.preview({ id: m.id, name: m.name, dose: m.dose, time: 'now' }); }, 10 * 60 * 1000);
      return;
    }
    await Storage.saveMedicationLog({
      patientId: P.id, medicineId: m.id, medicineName: m.name,
      scheduledTime: new Date().toISOString(), status: status,
      source: source || 'manual', confidence: confidence === undefined ? 1 : confidence
    });
    await Storage.saveAuditLog({
      actorId: P.id, actorRole: 'patient', action: 'medication.' + status,
      patientId: P.id, message: 'Patient logged "' + status + '" for ' + m.name + ' (source: ' + (source || 'manual') + ').'
    });
    P = await Storage.getPatient(P.id);
    App.toast(m.name + ' → ' + status.toUpperCase(), status === 'missed' ? 'warning' : 'success');
    renderMeds();
    renderDashboard();
    renderCalendar();
    document.dispatchEvent(new CustomEvent('vpdt:data'));
  }

  /* ------------------------------------------------------------ timeline */
  function renderTimeline() {
    var host = document.getElementById('timelineList');
    var events = (P.timeline || []).slice().sort(function (a, b) { return (a.day || 0) - (b.day || 0); });
    host.innerHTML = events.length ? events.map(function (e) {
      return '<li class="t-' + App.esc(e.type || 'info') + '">' +
        '<div class="tl-day">Day ' + App.esc(String(e.day)) + '</div>' +
        '<div class="tl-title">' + App.esc(e.title) + '</div>' +
        '<div class="tl-detail">' + App.esc(e.detail) + '</div></li>';
    }).join('') : '<li class="empty">No timeline events.</li>';

    var host2 = document.getElementById('chRiskTrend');
    var offsets = [27, 22, 17, 12, 7, 3, 0];
    var scores = offsets.map(function (o) { return Risk.assessOffset(P, o).score; });
    App.lineChart(host2, {
      labels: offsets.map(function (o) { return o === 0 ? 'today' : '-' + o + 'd'; }),
      series: [{ label: 'Demo risk score', data: scores, color: '#d64545' }],
      yMin: 0, yMax: 100, unit: 'risk 0-100 (demo rules)', legend: false
    });
  }

  /* -------------------------------------------------------------- charts */
  function renderCharts() {
    if (!P) return;
    var days = state.chartDays;
    var s = seriesFor(P, days);
    var labels = s.map(function (r) {
      if (!r.date) return String(r.daysAgo);
      var d = new Date(r.date + 'T12:00:00');
      return d.getDate() + '/' + (d.getMonth() + 1);
    });
    App.lineChart(document.getElementById('chSugar'), { labels: labels, series: [{ label: 'Blood sugar (mg/dL)', data: s.map(function (r) { return r.bloodSugar; }), color: '#6e6e6e' }], unit: 'mg/dL' });
    App.lineChart(document.getElementById('chBP'), {
      labels: labels,
      series: [
        { label: 'Systolic', data: s.map(function (r) { return r.systolicBP; }), color: '#1a1a1a' },
        { label: 'Diastolic', data: s.map(function (r) { return r.diastolicBP; }), color: '#8a8a8a' }
      ], unit: 'mmHg'
    });
    App.lineChart(document.getElementById('chHR'), {
      labels: labels,
      series: [
        { label: 'Heart rate', data: s.map(function (r) { return r.heartRate; }), color: '#4d4d4d' },
        { label: 'HRV', data: s.map(function (r) { return r.hrv; }), color: '#b5b5b5' }
      ], unit: 'bpm / ms'
    });
    App.lineChart(document.getElementById('chSleep'), {
      labels: labels,
      series: [{ label: 'Sleep (h)', data: s.map(function (r) { return r.sleepHours; }), color: '#3d3d3d' }],
      unit: 'hours'
    });
  }

  /* -------------------------------------------------- health calendar */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function toISODate(y, m, d) { return y + '-' + pad2(m + 1) + '-' + pad2(d); }
  function todayISO() { return DemoData.dateFromDaysAgo(0); }
  function dailyLogs() { return (P && P.dailyLogs) || {}; }
  function wearableByDate(iso) {
    if (!P || !P.wearableData) return null;
    for (var i = 0; i < P.wearableData.length; i++) {
      if (P.wearableData[i].date === iso) return P.wearableData[i];
    }
    return null;
  }
  function dayEntry(iso) {
    return dailyLogs()[iso] || null;
  }
  function hasDayData(iso) {
    if (dayEntry(iso)) return true;
    if (wearableByDate(iso)) return true;
    return false;
  }

  function renderCalendar() {
    var grid = document.getElementById('calGrid');
    if (!grid || !P) return;
    var now = new Date();
    if (state.calYear === null || state.calMonth === null) {
      state.calYear = now.getFullYear();
      state.calMonth = now.getMonth();
      state.calSelected = todayISO();
    }
    var y = state.calYear, m = state.calMonth;
    var monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('calTitle').textContent = monthNames[m] + ' ' + y;

    var first = new Date(y, m, 1);
    var startDay = first.getDay();
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var daysPrev = new Date(y, m, 0).getDate();
    var today = todayISO();
    var html = '';
    for (var i = startDay - 1; i >= 0; i--) {
      var pd = daysPrev - i;
      var pISO = toISODate(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, pd);
      html += calDayHTML(pISO, pd, true, today);
    }
    for (var d = 1; d <= daysInMonth; d++) {
      html += calDayHTML(toISODate(y, m, d), d, false, today);
    }
    var total = startDay + daysInMonth;
    var trail = (7 - (total % 7)) % 7;
    for (var t2 = 1; t2 <= trail; t2++) {
      var nISO = toISODate(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1, t2);
      html += calDayHTML(nISO, t2, true, today);
    }
    grid.innerHTML = html;
    renderCalDetail(state.calSelected);
  }

  function calDayHTML(iso, num, isOther, today) {
    var cls = 'cal-day' + (isOther ? ' is-other' : '') +
      (iso === today ? ' is-today' : '') +
      (iso === state.calSelected ? ' is-selected' : '');
    var e = dayEntry(iso);
    var w = wearableByDate(iso);
    var dots = '';
    var hasTab = (e && (e.tablets || e.tabletsNote)) || (w && false);
    var hasSleep = (e && e.sleepHours !== '' && e.sleepHours !== undefined && e.sleepHours !== null) || !!w;
    var hasHR = (e && e.heartRate !== '' && e.heartRate !== undefined && e.heartRate !== null) || !!w;
    var hasBP = (e && ((e.bpSys !== '' && e.bpSys !== undefined && e.bpSys !== null) || (e.bpDia !== '' && e.bpDia !== undefined && e.bpDia !== null))) || !!w;
    if (e || w) {
      dots = '<span class="cal-dots">' +
        (e && e.tablets ? '<span class="dot d-tab" title="Tablets logged"></span>' : '') +
        (hasSleep ? '<span class="dot d-sleep" title="Sleep"></span>' : '') +
        (hasHR ? '<span class="dot d-hr" title="Heart rate"></span>' : '') +
        (hasBP ? '<span class="dot d-bp" title="Blood pressure"></span>' : '') +
        '</span>';
      if (dots === '<span class="cal-dots"></span>') dots = '<span class="cal-dots"><span class="dot" title="Demo data"></span></span>';
    } else {
      dots = '<span class="cal-dots"></span>';
    }
    void hasTab;
    return '<button type="button" role="gridcell" class="' + cls + '" data-cal-day="' + iso + '" aria-label="' + iso + '">' +
      '<span class="dnum">' + num + '</span>' + dots + '</button>';
  }

  function renderCalDetail(iso) {
    var host = document.getElementById('calDetail');
    if (!host) return;
    if (!iso) { host.innerHTML = '<p class="empty">Select a day to view tablets, sleep, heart rate and blood pressure.</p>'; return; }
    var w = wearableByDate(iso) || {};
    var e = dayEntry(iso) || {};
    var dObj = new Date(iso + 'T12:00:00');
    var pretty = isNaN(dObj) ? iso : dObj.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    var sleepH = (e.sleepHours !== undefined && e.sleepHours !== '' && e.sleepHours !== null) ? e.sleepHours : (w.sleepHours || '–');
    var sleepQ = w.sleepQuality || '–';
    var hr = (e.heartRate !== undefined && e.heartRate !== '' && e.heartRate !== null) ? e.heartRate : (w.heartRate || '–');
    var rhr = w.restingHeartRate || '–';
    var sys = (e.bpSys !== undefined && e.bpSys !== '' && e.bpSys !== null) ? e.bpSys : (w.systolicBP || '–');
    var dia = (e.bpDia !== undefined && e.bpDia !== '' && e.bpDia !== null) ? e.bpDia : (w.diastolicBP || '–');
    var tab = e.tablets || (w ? '' : '');
    var tabNote = e.tabletsNote || '';

    var medNames = (P.medicines || []).map(function (m) { return App.esc(m.name + ' ' + (m.dose || '')); }).join(', ') || 'No medicines scheduled';

    host.innerHTML =
      '<div class="cal-detail-head"><h3>' + App.esc(pretty) + '</h3><span class="tag">' + App.esc(iso) + '</span></div>' +
      '<p class="small muted">Scheduled tablets: ' + medNames + '</p>' +
      '<div class="cal-kv-grid">' +
        '<div class="cal-kv"><div class="k">💊 Tablets</div><div class="v">' + App.esc(tab ? tab.toUpperCase() : '—') + '</div><div class="s">' + App.esc(tabNote || (tab ? '' : 'Not logged yet')) + '</div></div>' +
        '<div class="cal-kv"><div class="k">💤 Sleep</div><div class="v">' + App.esc(String(sleepH)) + ' <small style="font-weight:400">h</small></div><div class="s">quality ' + App.esc(String(sleepQ)) + ' · demo</div></div>' +
        '<div class="cal-kv"><div class="k">❤️ Heart rate</div><div class="v">' + App.esc(String(hr)) + ' <small style="font-weight:400">bpm</small></div><div class="s">resting ' + App.esc(String(rhr)) + ' bpm</div></div>' +
        '<div class="cal-kv"><div class="k">🩺 Blood pressure</div><div class="v">' + App.esc(String(sys)) + '/' + App.esc(String(dia)) + '</div><div class="s">mmHg · demo</div></div>' +
      '</div>' +
      '<form id="calForm" novalidate>' +
        '<h3 style="margin:.4rem 0 .3rem">Log this day</h3>' +
        '<p class="fineprint">Saved locally in this browser only (demo). Empty fields keep demo values. See <a href="privacy.html">Privacy Policy</a>.</p>' +
        '<div class="cal-form-grid">' +
          '<div class="field"><label for="calTablets">Tablets</label><select id="calTablets">' +
            '<option value="">—</option>' +
            '<option value="taken"' + (tab === 'taken' ? ' selected' : '') + '>Taken</option>' +
            '<option value="missed"' + (tab === 'missed' ? ' selected' : '') + '>Missed</option>' +
            '<option value="later"' + (tab === 'later' ? ' selected' : '') + '>Remind later</option>' +
          '</select><span class="hint">Did you take tablets?</span></div>' +
          '<div class="field"><label for="calTabNote">Tablet note</label><input type="text" id="calTabNote" maxlength="80" placeholder="e.g. Morning dose done" value="' + App.esc(tabNote).replace(/"/g, '&quot;') + '"></div>' +
          '<div class="field"><label for="calSleep">Sleep (hours)</label><input type="number" id="calSleep" min="0" max="16" step="0.5" placeholder="7.5" value="' + App.esc(e.sleepHours !== undefined && e.sleepHours !== null ? String(e.sleepHours) : '') + '"></div>' +
          '<div class="field"><label for="calHR">Heart rate (bpm)</label><input type="number" id="calHR" min="30" max="220" step="1" placeholder="72" value="' + App.esc(e.heartRate !== undefined && e.heartRate !== null ? String(e.heartRate) : '') + '"></div>' +
          '<div class="field"><label for="calSys">BP systolic</label><input type="number" id="calSys" min="70" max="260" step="1" placeholder="120" value="' + App.esc(e.bpSys !== undefined && e.bpSys !== null ? String(e.bpSys) : '') + '"></div>' +
          '<div class="field"><label for="calDia">BP diastolic</label><input type="number" id="calDia" min="40" max="160" step="1" placeholder="80" value="' + App.esc(e.bpDia !== undefined && e.bpDia !== null ? String(e.bpDia) : '') + '"></div>' +
        '</div>' +
        '<div class="btn-row"><button type="submit" class="btn btn-primary btn-sm">💾 Save day</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" id="calClear">Clear</button></div>' +
        '<p class="fineprint" id="calMsg" role="status"></p>' +
      '</form>';

    var form = document.getElementById('calForm');
    form.addEventListener('submit', function (ev) { ev.preventDefault(); saveCalDay(iso); });
    var clr = document.getElementById('calClear');
    if (clr) clr.addEventListener('click', function () { clearCalDay(iso); });
  }

  async function saveCalDay(iso) {
    var msg = document.getElementById('calMsg');
    try {
      var tablets = document.getElementById('calTablets').value || '';
      var note = document.getElementById('calTabNote').value.trim();
      var sleepV = document.getElementById('calSleep').value;
      var hrV = document.getElementById('calHR').value;
      var sysV = document.getElementById('calSys').value;
      var diaV = document.getElementById('calDia').value;
      if (sleepV !== '' && (+sleepV < 0 || +sleepV > 16)) { App.toast('Sleep must be 0–16 hours.', 'error'); return; }
      if (hrV !== '' && (+hrV < 30 || +hrV > 220)) { App.toast('Heart rate must be 30–220 bpm.', 'error'); return; }
      if (sysV !== '' && (+sysV < 70 || +sysV > 260)) { App.toast('Systolic must be 70–260.', 'error'); return; }
      if (diaV !== '' && (+diaV < 40 || +diaV > 160)) { App.toast('Diastolic must be 40–160.', 'error'); return; }
      var fresh = await Storage.getPatient(P.id);
      fresh.dailyLogs = fresh.dailyLogs || {};
      fresh.dailyLogs[iso] = {
        tablets: tablets, tabletsNote: note,
        sleepHours: sleepV === '' ? '' : Number(sleepV),
        heartRate: hrV === '' ? '' : Math.round(Number(hrV)),
        bpSys: sysV === '' ? '' : Math.round(Number(sysV)),
        bpDia: diaV === '' ? '' : Math.round(Number(diaV)),
        updatedAt: new Date().toISOString()
      };
      if (!tablets && !note && sleepV === '' && hrV === '' && sysV === '' && diaV === '') {
        delete fresh.dailyLogs[iso];
      }
      await Storage.savePatient(fresh);
      P = fresh;
      await Storage.saveAuditLog({ actorId: P.id, actorRole: 'patient', action: 'calendar.saved', patientId: P.id, message: 'Daily log saved for ' + iso + ' (demo, local only).' });
      App.toast('Saved ' + iso + ' (demo).', 'success');
      renderCalendar();
      renderHistory();
    } catch (err) {
      if (msg) msg.textContent = 'Could not save: ' + (err && err.message ? err.message : 'storage error');
      App.toast('Could not save day.', 'error');
    }
  }

  async function clearCalDay(iso) {
    var fresh = await Storage.getPatient(P.id);
    fresh.dailyLogs = fresh.dailyLogs || {};
    delete fresh.dailyLogs[iso];
    await Storage.savePatient(fresh);
    P = fresh;
    App.toast('Cleared ' + iso + '.', 'info');
    renderCalendar();
  }

  function bindCalendarNav() {
    var prev = document.getElementById('calPrev');
    var next = document.getElementById('calNext');
    var todayB = document.getElementById('calToday');
    if (prev) prev.addEventListener('click', function () {
      state.calMonth--;
      if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
      renderCalendar();
    });
    if (next) next.addEventListener('click', function () {
      state.calMonth++;
      if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
      renderCalendar();
    });
    if (todayB) todayB.addEventListener('click', function () {
      var n = new Date();
      state.calYear = n.getFullYear(); state.calMonth = n.getMonth();
      state.calSelected = todayISO();
      renderCalendar();
    });
    var grid = document.getElementById('calGrid');
    if (grid) grid.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cal-day]');
      if (!b) return;
      state.calSelected = b.getAttribute('data-cal-day');
      var d = new Date(state.calSelected + 'T12:00:00');
      if (!isNaN(d)) { state.calYear = d.getFullYear(); state.calMonth = d.getMonth(); }
      renderCalendar();
    });
  }

  /* ------------------------------------------------------------- history */
  async function renderHistory() {
    if (!P) return;
    var items = [];
    var advice = await Storage.getAdvice(P.id);
    advice.forEach(function (a) {
      items.push({ type: 'advice', date: a.timestamp, title: 'Advice: ' + (a.template || 'General'), detail: a.text, by: a.doctorName });
    });
    if (window.Clinical) {
      Clinical.getFollowUps(P).forEach(function (f) {
        items.push({ type: 'followups', date: f.dueDate || f.createdAt, title: 'Follow-up · ' + f.title + ' (' + (f.status || 'open') + ')', detail: (f.detail || '') + ' · by ' + (f.createdBy || 'care team'), by: '' });
      });
    }
    var logs = await Storage.getMedicationLogs(P.id);
    logs.forEach(function (l) {
      items.push({ type: l.status === 'taken' ? 'adherence' : 'medicines', date: l.actualTime, title: (l.medicineName || l.medicineId) + ' — ' + l.status, detail: 'Source: ' + l.source + ' · confidence ' + Math.round((l.confidence || 0) * 100) + '%' });
    });
    (P.visits || []).forEach(function (v) {
      items.push({ type: 'visits', date: v.date, title: 'Visit · ' + v.department, detail: v.notes + ' → ' + v.outcome, by: v.doctor });
    });
    (P.payments || []).forEach(function (x) {
      items.push({ type: 'payments', date: x.date, title: x.category + ' · ₹' + x.amount, detail: 'Status: ' + x.status + ' · receipt ' + x.id + ' (demo gateway - no real transaction occurs)' });
    });
    (P.alerts || []).forEach(function (a) {
      items.push({ type: 'alerts', date: a.timestamp, title: a.title, detail: a.reason + ' Action: ' + a.action });
    });
    var certs = (await Storage.getCertificates()).filter(function (c) { return c.patientId === P.id; });
    certs.forEach(function (c) {
      items.push({ type: 'certificates', date: c.completionDate, title: 'Certificate ' + c.id, detail: c.condition + ' · ' + c.periodStart + ' → ' + c.periodEnd + (c.summary && c.summary.length ? ' · ' + c.summary.map(function (s) { return s.label + ': ' + s.from + ' → ' + s.to; }).join(', ') : ''), link: 'certificate.html?id=' + encodeURIComponent(c.id) });
    });
    if (P.adherence) {
      items.push({ type: 'adherence', date: DemoData.dateFromDaysAgo(0), title: 'Adherence (7 days): ' + (P.adherence.percent || 0) + '%', detail: 'Last statuses: ' + ((P.adherence.last7 || []).join(', ') || 'n/a') });
    }
    seriesFor(P, 14).forEach(function (r) {
      var fake = Object.assign({}, P, { wearableData: [r] });
      items.push({ type: 'wellness', date: r.date, title: 'Wellness ' + Risk.wellness(fake).score + '/100', detail: 'sleep ' + r.sleepHours + ' h · steps ' + r.steps + ' · HRV ' + r.hrv + ' · stress ' + r.stressScore });
    });
    Object.keys((P.dailyLogs || {})).forEach(function (d) {
      var dl = P.dailyLogs[d];
      if (!dl) return;
      var parts = [];
      if (dl.tablets) parts.push('tablets: ' + dl.tablets + (dl.tabletsNote ? ' (' + dl.tabletsNote + ')' : ''));
      if (dl.sleepHours !== '' && dl.sleepHours !== undefined && dl.sleepHours !== null) parts.push('sleep ' + dl.sleepHours + ' h');
      if (dl.heartRate !== '' && dl.heartRate !== undefined && dl.heartRate !== null) parts.push('HR ' + dl.heartRate + ' bpm');
      if ((dl.bpSys !== '' && dl.bpSys !== undefined && dl.bpSys !== null) || (dl.bpDia !== '' && dl.bpDia !== undefined && dl.bpDia !== null)) parts.push('BP ' + (dl.bpSys || '–') + '/' + (dl.bpDia || '–'));
      items.push({ type: 'wellness', date: d, title: 'Daily log · ' + d, detail: parts.join(' · ') || 'Empty entry' });
    });

    items.sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
    var f = state.histFilter;
    var filtered = items.filter(function (it) { return f === 'all' || it.type === f; });
    var host = document.getElementById('histList');
    host.innerHTML = filtered.length ? '<ul class="list">' + filtered.slice(0, 60).map(function (it) {
      return '<li><div class="li-main">' +
        '<div class="li-title">' + App.esc(it.title) + '</div>' +
        '<div class="li-sub">' + App.esc(it.detail || '') + (it.by ? ' · ' + App.esc(it.by) : '') + '</div>' +
        '<div class="small muted">' + App.esc(App.fmtDate(it.date)) + '</div></div>' +
        '<div>' + (it.link ? '<a class="btn btn-ghost btn-sm" href="' + App.esc(it.link) + '">Open</a>' : '<span class="tag">' + App.esc(it.type) + '</span>') + '</div></li>';
    }).join('') + '</ul>' : '<p class="empty">No items in this category.</p>';
  }

  /* ------------------------------------------------------------ settings */
  function patientTelHref(phone) {
    var raw = String(phone || '').trim();
    if (!raw) return '';
    var digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    return 'tel:' + (raw.charAt(0) === '+' ? '+' : '') + digits;
  }
  function patientMailHref(email) {
    var ml = String(email || '').trim();
    if (!ml || ml.indexOf('@') === -1) return '';
    return 'mailto:' + ml;
  }
  function setLinkState(node, href) {
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
  function refreshPatientContactLinks() {
    var phEl = document.getElementById('setPhone');
    var emEl = document.getElementById('setEmail');
    var egEl = document.getElementById('setEmergency');
    var ph = phEl ? phEl.value.trim() : (P && P.phone) || '';
    var ml = emEl ? emEl.value.trim() : (P && P.email) || '';
    var eg = egEl ? egEl.value.trim() : (P && P.emergencyContact) || '';
    setLinkState(document.getElementById('setPhoneCall'), patientTelHref(ph));
    setLinkState(document.getElementById('setEmgCall'), patientTelHref(eg));
    setLinkState(document.getElementById('setEmailBtn'), patientMailHref(ml));
  }
  function copyPatientText(value, label) {
    var v = String(value || '').trim();
    if (!v) { App.toast('Nothing to copy yet — enter a value first.', 'error'); return; }
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
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(v).then(done, fallback);
    } else fallback();
  }
  function demoPatientSms(value, label) {
    var v = String(value || '').trim();
    if (!v) { App.toast('No ' + label + ' to message yet.', 'error'); return; }
    if (!isValidPhone(v)) { App.toast(label + ' looks invalid — use 7–15 digits.', 'error'); return; }
    App.toast('Demo SMS simulated to ' + v + ' — no real message sent.', 'success');
  }
  function renderSettings() {
    if (!P) return;
    var c = (P.consent && P.consent.items) || {};
    document.getElementById('setReminders').checked = !!Notify.isEnabled();
    document.getElementById('setWakePhrase').value = P.wakePhrase || 'help me assistant 3056';
    document.getElementById('setWake').checked = Speech.wakeListening();
    document.getElementById('storeModeLine').textContent = 'Storage: ' + App.storeMode() + ' · synthetic data only';
    document.getElementById('toggleMic').textContent = c.microphone ? 'Disable microphone' : 'Enable microphone';
    document.getElementById('toggleNotif').textContent = c.notifications ? 'Disable notifications' : 'Enable notifications';
    var pidEl = document.getElementById('setPatientId');
    if (pidEl) pidEl.textContent = P.id || '—';
    var ph = document.getElementById('setPhone');
    if (ph && document.activeElement !== ph) ph.value = P.phone || '';
    var em = document.getElementById('setEmail');
    if (em && document.activeElement !== em) em.value = P.email || '';
    var eg = document.getElementById('setEmergency');
    if (eg && document.activeElement !== eg) eg.value = P.emergencyContact || '';
    refreshPatientContactLinks();
  }

  async function savePatientContact() {
    var msgEl = document.getElementById('contactSaveMsg');
    function fail(t) {
      if (msgEl) { msgEl.textContent = t; msgEl.style.color = 'var(--red, #c0392b)'; }
      App.toast(t, 'error');
    }
    try {
      if (!P || !P.id) { fail('You are not signed in as a patient yet.'); return; }
      var phEl = document.getElementById('setPhone');
      var emEl = document.getElementById('setEmail');
      var egEl = document.getElementById('setEmergency');
      if (!phEl || !emEl || !egEl) { fail('Contact form is not ready yet.'); return; }
      var phone = phEl.value.trim();
      var email = emEl.value.trim().toLowerCase();
      var emergency = egEl.value.trim();
      if (!phone) { fail('Phone number is required.'); phEl.focus(); return; }
      if (!isValidPhone(phone)) { fail('Phone looks invalid — use 7–15 digits, e.g. +91-9000000001.'); phEl.focus(); return; }
      if (!email) { fail('Email address is required.'); emEl.focus(); return; }
      if (!isValidEmail(email)) { fail('Email looks invalid — expected name@example.com.'); emEl.focus(); return; }
      if (emergency && !isValidPhone(emergency)) { fail('Emergency contact looks invalid — use 7–15 digits or leave it empty.'); egEl.focus(); return; }
      if (emergency && emergency === phone) { fail('Phone and emergency contact should be different numbers.'); egEl.focus(); return; }
      var p = await Storage.getPatient(P.id);
      if (!p) { fail('Patient record not found locally.'); return; }
      p.phone = phone; p.email = email; p.emergencyContact = emergency;
      await Storage.savePatient(p);
      P = p;
      await Storage.saveAuditLog({ actorId: p.id, actorRole: 'patient', action: 'contact.updated', patientId: p.id, message: 'Patient updated contact: phone ' + phone + ', email ' + email + ' (demo, local only).' });
      if (msgEl) { msgEl.textContent = 'Phone & email saved locally.'; msgEl.style.color = 'inherit'; }
      App.toast('Phone & email saved.', 'success');
      renderSettings();
    } catch (e) {
      fail('Could not save contact: ' + (e && e.message ? e.message : 'storage error'));
    }
  }
  function bindPatientContactActions() {
    ['setPhone', 'setEmergency', 'setEmail'].forEach(function (id) {
      var n = document.getElementById(id);
      if (n) n.addEventListener('input', function () {
        refreshPatientContactLinks();
        var m = document.getElementById('contactSaveMsg');
        if (m) m.textContent = '';
      });
    });
    var pc = document.getElementById('setPhoneCopy');
    if (pc) pc.addEventListener('click', function () { copyPatientText(document.getElementById('setPhone').value, 'Phone number'); });
    var ec = document.getElementById('setEmgCopy');
    if (ec) ec.addEventListener('click', function () { copyPatientText(document.getElementById('setEmergency').value, 'Emergency contact'); });
    var mc = document.getElementById('setEmailCopy');
    if (mc) mc.addEventListener('click', function () { copyPatientText(document.getElementById('setEmail').value, 'Email'); });
    var ps = document.getElementById('setPhoneSms');
    if (ps) ps.addEventListener('click', function () { demoPatientSms(document.getElementById('setPhone').value, 'phone number'); });
    var es = document.getElementById('setEmgSms');
    if (es) es.addEventListener('click', function () { demoPatientSms(document.getElementById('setEmergency').value, 'emergency contact'); });
    var call1 = document.getElementById('setPhoneCall');
    if (call1) call1.addEventListener('click', function () {
      var v = document.getElementById('setPhone').value.trim();
      if (!v) return;
      App.toast('Dialling ' + v + ' via tel: link (demo — no auto-call).', 'info');
    });
    var call2 = document.getElementById('setEmgCall');
    if (call2) call2.addEventListener('click', function () {
      var v = document.getElementById('setEmergency').value.trim();
      if (!v) return;
      App.toast('Dialling emergency contact ' + v + ' via tel: link (demo).', 'info');
    });
    var rst = document.getElementById('contactResetBtn');
    if (rst) rst.addEventListener('click', function () {
      if (!P) return;
      document.getElementById('setPhone').value = P.phone || '';
      document.getElementById('setEmail').value = P.email || '';
      document.getElementById('setEmergency').value = P.emergencyContact || '';
      refreshPatientContactLinks();
      var m = document.getElementById('contactSaveMsg');
      if (m) m.textContent = '';
      App.toast('Contact fields reset.', 'info');
    });
    refreshPatientContactLinks();
  }

  async function saveConsentItem(key, val) {
    var p = await Storage.getPatient(P.id);
    p.consent = p.consent || { given: true, items: {} };
    p.consent.items = p.consent.items || {};
    p.consent.items[key] = val;
    await Storage.savePatient(p);
    P = p;
    await Storage.saveAuditLog({ actorId: p.id, actorRole: 'patient', action: 'consent.changed', patientId: p.id, message: 'Consent "' + key + '" set to ' + val });
    renderSettings();
  }

  /* ----------------------------------------------------------- assistant */
  function bindAssistant() {
    Assistant.bindChat({
      form: document.getElementById('chatForm'),
      input: document.getElementById('chatInput'),
      log: document.getElementById('chatLog'),
      speakButton: true,
      speakAnswers: false,
      voiceButton: document.getElementById('chatMic')
    });
    var host = document.getElementById('chatLog');
    host.innerHTML = '';
    var b = document.createElement('div');
    b.className = 'chat-bubble';
    b.innerHTML = '<div class="chat-who">Assistant · offline knowledge base (180+ questions)</div><div class="chat-text">Namaste! Ask me any health question below — for example: fever, chest pain, high BP, cough, stomach pain, headache, sugar, periods, pregnancy, child fever, skin, sleep, or emergency (112/108). I give general guidance only, not a diagnosis. Demo for education only.</div>';
    host.appendChild(b);
    renderChatTopics();

    document.addEventListener('click', function (ev) {
      var btn = ev.target.closest ? ev.target.closest('#view-assistant [data-q], #chatTopics [data-q]') : null;
      if (!btn) return;
      var input = document.getElementById('chatInput');
      var form = document.getElementById('chatForm');
      if (!input || !form) return;
      input.value = btn.getAttribute('data-q');
      if (form.requestSubmit) form.requestSubmit();
      else form.dispatchEvent(new Event('submit', { cancelable: true }));
    });
    document.getElementById('aiCheck').addEventListener('click', function () {
      Assistant.detectOllama().then(function (r) {
        App.toast(r.status === 'connected' ? ('Local AI: Connected (' + r.model + ')') : 'Local AI: Not available — using the offline knowledge base.', r.status === 'connected' ? 'success' : 'info');
      });
    });
    document.getElementById('aiSpeakOn').addEventListener('click', function () {
      state.speakAnswers = !state.speakAnswers;
      this.textContent = '🔊 Read answers aloud: ' + (state.speakAnswers ? 'on' : 'off');
      if (state.speakAnswers && !Speech.ttsSupported()) {
        App.toast('Speech synthesis is not supported in this browser.', 'info');
        state.speakAnswers = false;
        this.textContent = '🔊 Read answers aloud: off';
      }
    });
    // speak each new bot bubble when enabled
    var obs = new MutationObserver(function (muts) {
      if (!state.speakAnswers) return;
      muts.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType === 1 && n.classList && n.classList.contains('chat-bot')) {
            var t = n.querySelector('.chat-text');
            if (t) Speech.speak(t.textContent);
          }
        });
      });
    });
    obs.observe(document.getElementById('chatLog'), { childList: true });
    Assistant.detectOllama();
  }

  /* Browse all KB questions grouped by topic, with search */
  function topicOf(e) {
    var id = e.id || '';
    if (/fever|baby-fever|dengue|malaria|burning-urine|night-tb/.test(id)) return 'Fever & infection';
    if (/chest-pain|racing|high-bp|ankle|breathless|dizzy-standing/.test(id)) return 'Heart & chest';
    if (/cough|wheezing|cold-flu/.test(id)) return 'Breathing, cold & cough';
    if (/loose|vomiting|acidity|appendicitis|black-stools|jaundice|constipation/.test(id)) return 'Stomach & digestion';
    if (/headache|stroke|vertigo|seizure|numbness|migraine/.test(id)) return 'Head, brain & nerves';
    if (/sugar|thirst|foot-wound|weight-loss|tired/.test(id)) return 'Diabetes & energy';
    if (/back|joint|injury|knee-/.test(id)) return 'Bones, joints & muscles';
    if (/period|missed-period|preg|movements|breast-lump|white-discharge/.test(id)) return "Women's health & pregnancy";
    if (/^kb-child|paracetamol-dose/.test(id)) return 'Children';
    if (/allergy|mole|vision|red-eye|ear-|itchy-rash|sore-throat|blocked-nose|nosebleed|ringing|hearing|hoarse|mouth|gums|snoring|toothache|blurry|floaters|dry-eyes|eye-check|cataract|glaucoma|acne|white-patches|fungal|dandruff|neck-dark|dry-skin|boils|hives|warts|burn-blister/.test(id)) return 'Skin, eyes, ears, nose & mouth';
    if (/depression|panic|self-harm|insomnia|forgetting|teen-mood/.test(id)) return 'Mind & sleep';
    if (/flank|blood-urine|low-urine|recurrent-uti|foamy|night-urine|weak-stream|bladder|uric|gout|water-stones|face-swelling/.test(id)) return 'Urine & kidney';
    if (/overdose|poison|bite|collapsed|burn|sting/.test(id)) return 'Emergencies & bites';
    if (/lump-growing|night-sweats|hair-loss|bruise/.test(id)) return 'Warning signs';
    if (/hypo|hyper|thyroid|neck-lump|facial-hair|testosterone/.test(id)) return 'Hormones & thyroid';
    if (/haemoglobin|anemia|platelet|wbc|immunity|esr|dust-allergy|allergy-test/.test(id)) return 'Blood & immunity';
    if (/erectile|testicle|sperm|prostate/.test(id)) return "Men's health";
    if (/liver|hepatitis|hepb|bloating|swallowing|piles|anal-tear|lactose|hernia/.test(id)) return 'Liver & gut';
    if (/neck-pain|shoulder|heel|carpal|slipped|exercise| cramps|calcium/.test(id)) return 'Pain & exercise';
    if (/preg-tests|preg-nausea|preg-foods|preg-travel|delivery|miscarriage|trying-conceive|breastfeeding|postpartum|puberty|bedwetting|child-ear|child-speech/.test(id)) return 'Pregnancy, children & teens';
    if (/parent|falls|confusion|memory|medicines|bedsores|elderly-sleep/.test(id)) return 'Elderly care';
    if (/checkups|quit|alcohol|heart-diet|belly|multivitamin|vaccines|cancer-risk/.test(id)) return 'Lifestyle & checkups';
    return 'General';
  }

  async function renderChatTopics() {
    var box = document.getElementById('chatTopics');
    var search = document.getElementById('chatSearch');
    var count = document.getElementById('kbCount');
    if (!box) return;
    var kb;
    try { kb = await Assistant.ensureKB(); }
    catch (e) {
      box.innerHTML = '<p class="hint">Questions unavailable — could not load data/knowledge-base.json. Check your connection/server and reload.</p>';
      if (count) count.textContent = 'UNAVAILABLE';
      return;
    }
    var total = (kb.entries || []).filter(function (e) { return e.question; }).length;
    if (count) count.textContent = total + ' QUESTIONS';
    var groups = {};
    (kb.entries || []).forEach(function (e) {
      if (!e.question) return;
      var t = topicOf(e);
      (groups[t] = groups[t] || []).push(e);
    });
    function paint(filter) {
      var f = String(filter || '').toLowerCase().trim();
      var html = '';
      Object.keys(groups).sort().forEach(function (t) {
        var list = groups[t].filter(function (e) {
          return !f || e.question.toLowerCase().indexOf(f) !== -1 || (e.keywords || []).join(' ').toLowerCase().indexOf(f) !== -1;
        });
        if (!list.length) return;
        html += '<details class="chat-topic"><summary><strong>' + App.esc(t) + '</strong> (' + list.length + ')</summary><div class="chip-row" style="margin:.4rem 0">';
        list.forEach(function (e) {
          html += '<button type="button" class="chip" data-q="' + App.esc(e.question) + '">' + App.esc(e.question) + '</button>';
        });
        html += '</div></details>';
      });
      box.innerHTML = html || '<p class="hint">No matches. Try: fever, chest pain, periods, pregnancy, child.</p>';
    }
    paint('');
    if (search && !search.dataset.bound) {
      search.dataset.bound = '1';
      search.addEventListener('input', function () {
        paint(search.value);
        var d = document.getElementById('chatBrowse');
        if (d && search.value.trim()) d.open = true;
      });
    }
  }

  /* --------------------------------------------------------------- SOS */
  async function triggerSOS() {
    if (!P) return;
    await Speech.emergency('SOS button pressed', { patient: P });
    renderDashboard();
  }

  /* ------------------------------------------------------------- events */
  function bindEvents() {
    // navigation
    document.addEventListener('click', function (e) {
      var nav = e.target.closest('[data-view]');
      if (nav) {
        e.preventDefault();
        var v = nav.getAttribute('data-view');
        setView(v);
        document.body.classList.remove('nav-open');
        return;
      }
      var goto = e.target.closest('[data-goto]');
      if (goto) { e.preventDefault(); setView(goto.getAttribute('data-goto')); return; }

      var sos = e.target.closest('[data-sos]');
      if (sos) { e.preventDefault(); triggerSOS(); return; }

      var log = e.target.closest('[data-log]');
      if (log) { e.preventDefault(); logMed(log.getAttribute('data-med'), log.getAttribute('data-log'), 'manual', 1); return; }

      var taken = e.target.closest('[data-taken]');
      if (taken) { e.preventDefault(); logMed(taken.getAttribute('data-taken'), 'taken', 'manual', 1); return; }

      var read = e.target.closest('[data-read]');
      if (read) { e.preventDefault(); openAdvice(read.getAttribute('data-read')); return; }

      var ack = e.target.closest('[data-ack]');
      if (ack) { e.preventDefault(); acknowledgeAdvice(ack.getAttribute('data-ack')); return; }

      var book = e.target.closest('[data-book]');
      if (book) { e.preventDefault(); bookConsultation(); return; }

      var day = e.target.closest('[data-days]');
      if (day) {
        state.chartDays = Number(day.getAttribute('data-days'));
        document.querySelectorAll('[data-days]').forEach(function (b) { b.setAttribute('aria-pressed', b === day ? 'true' : 'false'); });
        renderCharts();
        return;
      }

      var chip = e.target.closest('#histFilters .chip');
      if (chip) {
        state.histFilter = chip.getAttribute('data-filter');
        document.querySelectorAll('#histFilters .chip').forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
        renderHistory();
      }
    });

    document.getElementById('navToggle').addEventListener('click', function () {
      var open = document.body.classList.toggle('nav-open');
      this.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    document.getElementById('reminderToggle').addEventListener('change', function () {
      if (this.checked) Notify.enable(P.id);
      else Notify.disable();
      renderSettings();
    });
    document.getElementById('setReminders').addEventListener('change', function () {
      if (this.checked) Notify.enable(P.id);
      else Notify.disable();
      this.checked = Notify.isEnabled();
    });

    document.addEventListener('vpdt:quick-taken', function (e) {
      var med = e.detail;
      if (med && med.id) logMed(med.id, 'taken', 'reminder', 1);
    });

    document.addEventListener('vpdt:data', function () {
      if (!P || !state.ready) return;
      Storage.getPatient(P.id).then(function (p) {
        if (p) { P = p; renderDashboard(); renderMeds(); renderHistory(); renderCalendar(); }
      });
    });

    // settings actions — contact block now has Call / Copy / SMS + Save + Reset, all live.
    var csBtn = document.getElementById('contactSaveBtn');
    if (csBtn) csBtn.addEventListener('click', savePatientContact);
    bindPatientContactActions();
    document.getElementById('viewConsent').addEventListener('click', showConsentView);
    document.getElementById('changeConsent').addEventListener('click', showConsentEdit);
    document.getElementById('revokeCaregiver').addEventListener('click', async function () {
      var ok = await App.confirm('Revoke caregiver access?\n\nThe caregiver will immediately lose access to medicines, appointments, alerts and wellness in this demo.', { title: 'Revoke caregiver access' });
      if (!ok) return;
      var p = await Storage.getPatient(P.id);
      p.consent = p.consent || {};
      p.consent.items = p.consent.items || {};
      p.consent.items.caregiverAccess = false;
      p.consent.items.caregiverSharing = false;
      p.consent.caregiver = p.consent.caregiver || {};
      p.consent.caregiver.granted = false;
      await Storage.savePatient(p);
      P = p;
      await Storage.saveAuditLog({ actorId: p.id, actorRole: 'patient', action: 'consent.caregiver.revoked', patientId: p.id, message: 'Caregiver access revoked by patient.' });
      App.toast('Caregiver access revoked.', 'success');
      renderSettings();
    });
    document.getElementById('toggleMic').addEventListener('click', function () {
      var cur = !!(P.consent && P.consent.items && P.consent.items.microphone);
      saveConsentItem('microphone', !cur);
      if (cur) Speech.stopWakePhrase();
      App.toast('Microphone ' + (!cur ? 'enabled' : 'disabled'), 'info');
    });
    document.getElementById('toggleNotif').addEventListener('click', function () {
      var cur = !!(P.consent && P.consent.items && P.consent.items.notifications);
      saveConsentItem('notifications', !cur);
      App.toast('Notifications preference updated.', 'info');
    });
    document.getElementById('deleteDataBtn').addEventListener('click', async function () {
      var ok = await App.confirm('Are you sure?\n\nThis removes locally stored demo data from this browser (logs, alerts, audit entries and settings).\n\nThe synthetic demo dataset will be re-created on the next load.', {
        title: 'Delete My Data', danger: true, typeToConfirm: 'DELETE', confirmLabel: 'Delete'
      });
      if (!ok) return;
      await Storage.clearAllLocalData();
      App.toast('Local demo data deleted. Reloading…', 'success');
      setTimeout(function () { window.location.href = 'index.html'; }, 900);
    });
    document.getElementById('importBtn').addEventListener('click', function () { document.getElementById('importFile').click(); });
    document.getElementById('importFile').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var obj = JSON.parse(String(reader.result));
          Storage.importAll(obj).then(function () {
            App.toast('Demo data imported. Reloading…', 'success');
            setTimeout(function () { window.location.reload(); }, 800);
          });
        } catch (err) {
          App.toast('Invalid JSON file — import cancelled.', 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    document.getElementById('setWakePhrase').addEventListener('change', async function () {
      var v = this.value.trim() || 'help me assistant 3056';
      var p = await Storage.getPatient(P.id);
      p.wakePhrase = v;
      await Storage.savePatient(p);
      P = p;
      App.toast('Wake phrase saved.', 'success');
    });
    document.getElementById('setWake').addEventListener('change', function () {
      if (this.checked) startWake();
      else { Speech.stopWakePhrase(); App.toast('Wake phrase listening stopped.', 'info'); }
      renderSettings();
    });
    document.getElementById('testWake').addEventListener('click', function () {
      if (!Speech.supported()) { App.toast(App.t('voiceUnsupported'), 'info'); return; }
      App.toast('Simulating wake phrase detection (test)…', 'info');
      Speech.emergency('Wake phrase detected (test)', { patient: P });
    });

    App.registerChartRedraw(function () { if (state.ready) { renderCharts(); renderTimeline(); } });
  }

  function startWake() {
    if (!P.consent || !P.consent.items || !P.consent.items.microphone) {
      App.toast('Enable microphone permission in consent settings first.', 'error');
      document.getElementById('setWake').checked = false;
      return;
    }
    if (!Speech.supported()) { App.toast(App.t('voiceUnsupported'), 'info'); document.getElementById('setWake').checked = false; return; }
    var ok = Speech.startWakePhrase(P.wakePhrase, {
      onDetect: function () { Speech.emergency('Wake phrase detected: "' + P.wakePhrase + '"', { patient: P }); },
      onError: function (err) { App.toast('Wake phrase could not start (' + err + ').', 'error'); document.getElementById('setWake').checked = false; }
    });
    if (ok) App.toast('Wake phrase listening active while this page is open.', 'success');
  }

  function showConsentView() {
    var c = (P.consent && P.consent.items) || {};
    var lines = Object.keys(c).map(function (k) { return (c[k] ? '✓ ' : '✗ ') + k; }).join('\n');
    App.modal({
      title: 'Current consent (demo)',
      body: 'Consent date: ' + (P.consent && P.consent.date ? App.fmtDate(P.consent.date) : 'not recorded') + '\n\n' + lines +
        '\n\nCaregiver: ' + ((P.consent && P.consent.caregiver && P.consent.caregiver.granted) ? 'granted' : 'not granted') +
        '\n\nDemo for education only, not medical advice.',
      actions: [{ label: 'Close', value: true, primary: true }]
    });
  }
  function showConsentEdit() {
    var c = (P.consent && P.consent.items) || {};
    var body = document.createElement('div');
    body.innerHTML =
      '<div class="check-row"><input type="checkbox" id="ceDoc"' + (c.doctorSharing ? ' checked' : '') + '><label for="ceDoc">Share with doctor / care team</label></div>' +
      '<div class="check-row"><input type="checkbox" id="ceCare"' + (c.caregiverAccess ? ' checked' : '') + '><label for="ceCare">Caregiver access</label></div>' +
      '<div class="check-row"><input type="checkbox" id="ceMic"' + (c.microphone ? ' checked' : '') + '><label for="ceMic">Microphone (voice features)</label></div>' +
      '<div class="check-row"><input type="checkbox" id="ceNot"' + (c.notifications ? ' checked' : '') + '><label for="ceNot">Reminder notifications</label></div>' +
      '<div class="check-row"><input type="checkbox" id="ceAi"' + (c.aiFeatures ? ' checked' : '') + '><label for="ceAi">Optional AI features</label></div>';
    App.modal({
      title: 'Change consent', bodyNode: body,
      actions: [
        { label: App.t('cancel'), value: false },
        {
          label: App.t('save'), primary: true, onClick: async function () {
            await saveConsentItem('doctorSharing', body.querySelector('#ceDoc').checked);
            await saveConsentItem('caregiverAccess', body.querySelector('#ceCare').checked);
            await saveConsentItem('caregiverSharing', body.querySelector('#ceCare').checked);
            await saveConsentItem('microphone', body.querySelector('#ceMic').checked);
            await saveConsentItem('notifications', body.querySelector('#ceNot').checked);
            await saveConsentItem('aiFeatures', body.querySelector('#ceAi').checked);
            App.toast('Consent updated.', 'success');
            return true;
          }
        }
      ]
    });
  }

  async function openAdvice(id) {
    var items = await Storage.getAdvice(P.id);
    var a = items.filter(function (x) { return x.id === id; })[0];
    if (!a) return;
    App.modal({
      title: 'Advice from ' + (a.doctorName || 'your care team'),
      body: (a.template ? '[' + a.template + ']\n\n' : '') + a.text + '\n\n— ' + App.fmtDate(a.timestamp) + '\n' + (a.aiDraft ? 'AI draft, approved by a human doctor before sending.\n' : '') + '\nDemo for education only, not medical advice.',
      actions: [
        { label: App.t('close'), value: false },
        { label: App.t('markUnderstood'), value: true, primary: true }
      ]
    }).then(function (r) { if (r) acknowledgeAdvice(id); });
  }
  async function acknowledgeAdvice(id) {
    var items = await Storage.getAdvice(P.id);
    var a = items.filter(function (x) { return x.id === id; })[0];
    if (!a) return;
    a.status = 'understood';
    await Storage.saveAdvice(a);
    await Storage.saveAuditLog({ actorId: P.id, actorRole: 'patient', action: 'advice.understood', patientId: P.id, message: 'Patient acknowledged advice from ' + (a.doctorName || 'care team') + '.' });
    App.toast('Advice marked as understood.', 'success');
    renderAdvice();
    renderHistory();
  }

  function bookConsultation() {
    var body = document.createElement('div');
    body.innerHTML =
      '<p class="small">Mock teleconsultation booking — no real appointment or payment is created.</p>' +
      '<div class="field"><label for="bkDate">Preferred date</label><input type="date" id="bkDate" value="' + DemoData.dateFromDaysAhead(3) + '"></div>' +
      '<div class="field"><label for="bkTime">Preferred time</label><input type="text" id="bkTime" value="11:00"></div>' +
      '<div class="field"><label for="bkReason">Reason (demo)</label><input type="text" id="bkReason" value="Review demo readings"></div>';
    App.modal({
      title: 'Book consultation', bodyNode: body,
      actions: [
        { label: App.t('cancel'), value: false },
        {
          label: 'Book', primary: true, onClick: async function () {
            var date = body.querySelector('#bkDate').value || DemoData.dateFromDaysAhead(3);
            var time = body.querySelector('#bkTime').value || '11:00';
            var apt = { id: 'APT-' + Date.now(), date: date, time: time, department: 'General Medicine', doctor: 'Dr. Asha Sharma', mode: 'Teleconsult', status: 'booked', synthetic: true };
            await Storage.updatePatient(P.id, { appointments: (P.appointments || []).concat([apt]) });
            P = await Storage.getPatient(P.id);
            await Storage.saveAuditLog({ actorId: P.id, actorRole: 'patient', action: 'consult.booked', patientId: P.id, message: 'Mock consultation booked for ' + date + ' ' + time + '.' });
            App.toast('Consultation booked (mock). ' + date + ' at ' + time, 'success');
            renderDashboard();
            renderHistory();
            return true;
          }
        }
      ]
    });
  }

  /* ------------------------------------------------------------- views */
  function setView(v) {
    state.view = v;
    document.querySelectorAll('.view').forEach(function (s) { s.classList.toggle('active', s.id === 'view-' + v); });
    document.querySelectorAll('[data-view]').forEach(function (b) {
      if (b.classList.contains('nav-link') || b.closest('.bottomnav')) {
        b.setAttribute('aria-current', b.getAttribute('data-view') === v ? 'page' : 'false');
      }
    });
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    if (v === 'history') renderHistory();
    if (v === 'medicines') renderMeds();
    if (v === 'timeline') renderTimeline();
    if (v === 'dashboard') { renderDashboard(); renderCalendar(); }
    if (v === 'assistant') setTimeout(function () { var i = document.getElementById('chatInput'); if (i) i.focus(); }, 60);
  }

  /* ---------------------------------------------------------- demo flow */
  function bindDemoFlow() {
    document.addEventListener('vpdt:demoStep', function (e) {
      var step = e.detail.step;
      if (step === 8) setView('dashboard');
      if (step === 9) setView('dashboard');
      if (step === 10) setView('dashboard');
    });
  }

  /* ================================================================ boot */
  App.boot('patient').then(function () {
    Sync.init();
    bindLogin();
    bindEvents();
    bindCalendarNav();
    bindAssistant();
    bindDemoFlow();
    return afterLogin();
  }).then(function () {
    App.DemoFlow.continueOnLoad('patient');
  }).catch(function (e) {
    console.error(e);
    App.toast('Patient app could not fully initialise: ' + (e && e.message ? e.message : ''), 'error');
    show('loginCard');
  });
})();
