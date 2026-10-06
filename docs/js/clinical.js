/*
 * clinical.js - shared helpers for:
 *  1) Ready-to-Use Patient Story (structured clinical summary for consultation start)
 *  2) Continuity of Care (medications, previous instructions, follow-ups)
 *  3) ABDM alignment (ABHA ID demo field, consent-aware export, DPDP-friendly wording)
 *
 * All data stays in this browser (IndexedDB/localStorage). No real ABDM/ABHA
 * network integration — demo-aligned fields + export only. Never claims real
 * Ayushman Bharat Digital Mission linkage.
 *
 * Demo for education only, not medical advice.
 */
window.Clinical = (function () {
  'use strict';

  function esc(s) {
    if (window.App && App.esc) return App.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtDate(d) {
    if (window.App && App.fmtDate) return App.fmtDate(d);
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('en-IN'); } catch (e) { return String(d); }
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ------------------------------------------------ follow-ups (continuity) */
  function getFollowUps(p) {
    if (!p) return [];
    if (Array.isArray(p.followUps)) return p.followUps;
    return [];
  }
  function pendingFollowUps(p) {
    return getFollowUps(p).filter(function (f) { return (f.status || 'open') === 'open'; })
      .sort(function (a, b) { return String(a.dueDate || '').localeCompare(String(b.dueDate || '')); });
  }
  function newFollowUp(title, dueDate, detail, createdBy) {
    return {
      id: 'FU-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase(),
      title: String(title || '').slice(0, 120),
      dueDate: dueDate || '',
      detail: String(detail || '').slice(0, 280),
      status: 'open',
      createdBy: createdBy || 'care team',
      createdAt: new Date().toISOString()
    };
  }
  function isValidFollowUp(title, dueDate) {
    if (!String(title || '').trim()) return 'Follow-up title is required (e.g. Recheck BP in 7 days).';
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return 'Due date must look like YYYY-MM-DD.';
    return '';
  }

  /* --------------------------------------- previous instructions (continuity) */
  // Unified "previous instructions": approved advice + doctor notes + suggestions,
  // newest first. Prevents repetitive questioning and keeps doctor + patient aligned.
  function getPreviousInstructions(p, adviceList) {
    var out = [];
    (adviceList || []).forEach(function (a) {
      out.push({
        kind: 'advice', date: a.timestamp,
        title: a.template || 'Doctor advice',
        detail: a.text || '',
        by: a.doctorName || a.doctorId || 'doctor'
      });
    });
    (p.doctorNotes || []).forEach(function (n) {
      out.push({
        kind: 'note', date: n.date || n.timestamp,
        title: 'Clinical note',
        detail: n.text || n.note || '',
        by: n.author || n.by || 'care team'
      });
    });
    (p.suggestions || []).forEach(function (s) {
      out.push({
        kind: 'suggestion', date: s.date || s.timestamp,
        title: 'Suggestion',
        detail: s.text || '',
        by: s.author || 'care team'
      });
    });
    out.sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
    return out;
  }

  /* ------------------------------------------------------- patient story */
  // Structured, complete summary shown at the START of every consultation so the
  // doctor does not waste time searching or asking repetitive questions.
  function buildPatientStory(p, risk, opts) {
    opts = opts || {};
    var adviceList = opts.adviceList || [];
    var alerts = opts.alerts || [];
    var medLogs = opts.medLogs || [];
    var lastWear = ((p.wearableData || []).slice(-1)[0]) || {};
    var lastVisit = (p.visits || []).slice(-1)[0] || null;
    var pending = pendingFollowUps(p);
    var prevInstr = getPreviousInstructions(p, adviceList);
    var openAlerts = alerts.filter(function (a) { return (a.status || 'open') === 'open'; })
      .concat((p.alerts || []).filter(function (a) { return (a.status || 'open') === 'open'; }));

    var meds = (p.medicines || []).map(function (m) {
      return (m.name || '') + ' ' + (m.dose || '') +
        (m.times && m.times.length ? ' @ ' + m.times.join(', ') : '') +
        (m.instructions ? ' — ' + m.instructions : '');
    });

    return {
      patient: { id: p.id, name: p.name, age: p.age, gender: p.gender, bloodGroup: p.bloodGroup || '-' },
      problems: p.diagnosis && p.diagnosis.length ? p.diagnosis.slice() : [p.condition || 'Stable'],
      allergies: (p.allergies || []).join(', ') || 'none recorded',
      risk: risk ? { score: risk.score, level: risk.level, label: risk.levelLabel || risk.level, topReasons: (risk.reasons || []).slice(0, 4) } : null,
      vitals: {
        bp: (lastWear.systolicBP || lastWear.bpSys || '-') + '/' + (lastWear.diastolicBP || lastWear.bpDia || '-'),
        sugar: lastWear.bloodSugar != null ? lastWear.bloodSugar : '-',
        hr: lastWear.heartRate != null ? lastWear.heartRate : '-',
        spo2: lastWear.spo2 != null ? lastWear.spo2 : '-',
        sleep: lastWear.sleepHours != null ? lastWear.sleepHours + 'h' : '-',
        date: lastWear.date || '-'
      },
      medicines: meds,
      adherence: (p.adherence && p.adherence.percent != null) ? p.adherence.percent + '%' : 'n/a',
      recentLogs: medLogs.slice(-3).map(function (l) { return (l.medicineName || l.medicineId) + '=' + l.status; }),
      lastVisit: lastVisit ? (fmtDate(lastVisit.date) + ' · ' + (lastVisit.department || '') + ' — ' + (lastVisit.outcome || lastVisit.notes || '')) : 'no visit recorded',
      pendingFollowUps: pending,
      openAlerts: openAlerts.slice(0, 5).map(function (a) { return { title: a.title, reason: a.reason || '', level: a.level || '' }; }),
      previousInstructions: prevInstr.slice(0, 5),
      totalPrevInstructions: prevInstr.length,
      abha: getAbha(p)
    };
  }

  function storyHTML(story) {
    function li(t) { return '<li class="li-sub">' + esc(t) + '</li>'; }
    var medBlock = story.medicines.length
      ? '<ul style="margin:.3rem 0;padding-left:1.1rem">' + story.medicines.slice(0, 6).map(li).join('') + '</ul>'
      : '<p class="empty">No active medicines.</p>';
    var fuBlock = story.pendingFollowUps.length
      ? '<ul style="margin:.3rem 0;padding-left:1.1rem">' + story.pendingFollowUps.slice(0, 4).map(function (f) {
        return '<li class="li-sub"><strong>' + esc(f.title) + '</strong>' +
          (f.dueDate ? ' · due ' + esc(fmtDate(f.dueDate)) : ' · no due date') +
          (f.detail ? ' — ' + esc(f.detail) : '') + '</li>';
      }).join('') + '</ul>'
      : '<p class="empty">No pending follow-ups.</p>';
    var instrBlock = story.previousInstructions.length
      ? '<ul style="margin:.3rem 0;padding-left:1.1rem">' + story.previousInstructions.slice(0, 3).map(function (x) {
        return '<li class="li-sub"><strong>' + esc(x.title) + '</strong> · ' + esc(String(x.detail || '').slice(0, 120)) +
          ' <span class="small muted">(' + esc(x.by || '') + ' · ' + esc(fmtDate(x.date)) + ')</span></li>';
      }).join('') + '</ul>' +
        (story.totalPrevInstructions > 3 ? '<p class="fineprint">+ ' + (story.totalPrevInstructions - 3) + ' more in Continuity of Care below.</p>' : '')
      : '<p class="empty">No previous instructions yet.</p>';
    var alertBlock = story.openAlerts.length
      ? '<ul style="margin:.3rem 0;padding-left:1.1rem">' + story.openAlerts.slice(0, 3).map(function (a) {
        return '<li class="li-sub">[' + esc(String(a.level || '').toUpperCase()) + '] ' + esc(a.title) +
          (a.reason ? ' — ' + esc(a.reason) : '') + '</li>';
      }).join('') + '</ul>'
      : '<p class="empty">No open alerts.</p>';

    return (
      '<div class="grid grid-2">' +
      '<div><p class="small muted" style="margin:0">PATIENT</p>' +
      '<p style="margin:.2rem 0"><strong>' + esc(story.patient.name) + '</strong> <span class="mono small">' + esc(story.patient.id) + '</span><br>' +
      '<span class="small">' + esc(String(story.patient.age)) + 'y · ' + esc(story.patient.gender || '-') + ' · Blood ' + esc(story.patient.bloodGroup) +
      ' · Allergies: ' + esc(story.allergies) + '</span></p>' +
      '<p class="small muted" style="margin:.4rem 0 0">ACTIVE PROBLEMS</p>' +
      '<p style="margin:.2rem 0">' + esc(story.problems.join(' · ')) + '</p>' +
      '<p class="small muted" style="margin:.4rem 0 0">RISK (demo rules)</p>' +
      '<p style="margin:.2rem 0"><strong>' + esc(String(story.risk ? story.risk.score : '-')) + '/100 · ' + esc(story.risk ? story.risk.label : '-') + '</strong><br>' +
      '<span class="small">' + esc((story.risk && story.risk.topReasons[0]) || 'no reasons') + '</span></p>' +
      '<p class="small muted" style="margin:.4rem 0 0">LAST VITALS (' + esc(String(story.vitals.date)) + ')</p>' +
      '<p class="small" style="margin:.2rem 0">BP ' + esc(String(story.vitals.bp)) + ' · Sugar ' + esc(String(story.vitals.sugar)) +
      ' · HR ' + esc(String(story.vitals.hr)) + ' · SpO2 ' + esc(String(story.vitals.spo2)) + ' · Sleep ' + esc(String(story.vitals.sleep)) + '</p></div>' +
      '<div><p class="small muted" style="margin:0">CURRENT MEDICATIONS (' + story.medicines.length + ') · adherence ' + esc(String(story.adherence)) + '</p>' + medBlock +
      '<p class="small muted" style="margin:.4rem 0 0">PENDING FOLLOW-UPS (' + story.pendingFollowUps.length + ')</p>' + fuBlock +
      '<p class="small muted" style="margin:.4rem 0 0">LAST VISIT</p><p class="small" style="margin:.2rem 0">' + esc(story.lastVisit) + '</p></div>' +
      '</div>' +
      '<div class="grid grid-2" style="margin-top:.6rem"><div>' +
      '<p class="small muted" style="margin:0">OPEN ALERTS</p>' + alertBlock + '</div><div>' +
      '<p class="small muted" style="margin:0">PREVIOUS INSTRUCTIONS (latest)</p>' + instrBlock + '</div></div>'
    );
  }

  /* ---------------------------------------------------------------- ABDM */
  // Demo-aligned ABDM support: ABHA ID field + consent-aware portable export.
  // No network calls. Labelling always says "(demo, not linked to real ABDM)".
  function getAbha(p) {
    var a = (p && p.abha) || {};
    return { id: String(a.id || '').trim(), linked: !!a.linked, consent: !!a.consent };
  }
  function isValidAbha(id) {
    // ABHA number is 14 digits; ABHA address looks like name@abdm. Accept both (demo validation).
    var v = String(id || '').trim();
    if (/^\d{4}-\d{4}-\d{4}$/.test(v)) return '';
    if (/^\d{14}$/.test(v)) return '';
    if (/^[a-zA-Z0-9._-]{3,}@abdm$/.test(v)) return '';
    return 'Enter a 14-digit ABHA number (e.g. 12-3456-7890-12) or ABHA address (e.g. name@abdm). Demo format check only.';
  }
  function normalizeAbha(id) { return String(id || '').trim(); }

  // Portable, consent-aware health-record export shaped around ABDM/HIP concepts
  // (patient demographics, problems, meds, visits, advice, follow-ups, consent state).
  // This is a local JSON download — NOT a real Health Information Exchange call.
  function buildAbdmRecord(p, extra) {
    extra = extra || {};
    return {
      format: 'ABDM-aligned demo export',
      version: '0.1-demo',
      exportedAt: new Date().toISOString(),
      synthetic: true,
      disclaimer: 'Synthetic demo data. Not a real ABDM / ABHA / Health Locker transaction. For education only, not medical advice.',
      abha: getAbha(p),
      patient: {
        id: p.id, name: p.name, age: p.age, gender: p.gender,
        bloodGroup: p.bloodGroup || '-', language: p.language || 'en',
        diagnosis: p.diagnosis || [], condition: p.condition || '',
        allergies: p.allergies || []
      },
      problems: (p.diagnosis && p.diagnosis.length ? p.diagnosis : [p.condition || 'Stable']),
      medications: (p.medicines || []).map(function (m) {
        return { name: m.name, dose: m.dose, schedule: m.schedule || m.scheduleType || '', times: m.times || [], instructions: m.instructions || '', prescribedBy: m.prescribedBy || '', startDate: m.startDate || '', endDate: m.endDate || '' };
      }),
      visits: p.visits || [],
      appointments: p.appointments || [],
      previousInstructions: getPreviousInstructions(p, extra.adviceList || []),
      followUps: getFollowUps(p),
      adherence: p.adherence || null,
      consent: {
        given: !!(p.consent && p.consent.given),
        doctorSharing: !!(p.consent && p.consent.items && p.consent.items.doctorSharing),
        caregiverSharing: !!(p.consent && p.consent.items && p.consent.items.caregiverSharing),
        abhaLinkConsent: getAbha(p).consent
      }
    };
  }
  function downloadAbdmRecord(p, extra) {
    var rec = buildAbdmRecord(p, extra);
    var blob = new Blob([JSON.stringify(rec, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'abdm-demo-' + (p.id || 'patient') + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    return rec;
  }

  return {
    todayISO: todayISO,
    getFollowUps: getFollowUps,
    pendingFollowUps: pendingFollowUps,
    newFollowUp: newFollowUp,
    isValidFollowUp: isValidFollowUp,
    getPreviousInstructions: getPreviousInstructions,
    buildPatientStory: buildPatientStory,
    storyHTML: storyHTML,
    getAbha: getAbha,
    isValidAbha: isValidAbha,
    normalizeAbha: normalizeAbha,
    buildAbdmRecord: buildAbdmRecord,
    downloadAbdmRecord: downloadAbdmRecord
  };
})();
