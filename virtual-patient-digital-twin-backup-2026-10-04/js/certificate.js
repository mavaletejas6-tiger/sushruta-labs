/*
 * certificate.js - treatment-completion certificate generator.
 *
 * The certificate is a DEMONSTRATION document:
 *   "DEMONSTRATION CERTIFICATE - Not a medical or legal document."
 * QR codes contain only a certificate identifier + verification page path,
 * never medical details.
 */
window.Certificate = (function () {
  'use strict';

  function certIdFor(patient) {
    if (patient.certId) return patient.certId;
    return 'CERT-' + String(patient.id || '').replace('PT-', '');
  }

  function buildFromPatient(patient, opts) {
    opts = opts || {};
    var t = patient.treatment || {};
    var meds = (patient.medicines || []).map(function (m) {
      var parts = [];
      if (m.times && m.times.length) parts.push(m.times.join(', '));
      if (m.frequency) parts.push(m.frequency);
      if (App.medSchedule) parts.push(App.medSchedule(m));
      if (App.medDateRange) parts.push(App.medDateRange(m));
      return {
        name: m.name, dose: m.dose,
        schedule: parts.join(' · '),
        history: 'Taken as scheduled in the demo log (adherence ' + ((patient.adherence && patient.adherence.percent) || 0) + '%)'
      };
    });
    var startISO = t.start || (patient.visits && patient.visits[0] && patient.visits[0].date) || DemoData.dateFromDaysAgo(90);
    var endISO = t.end || opts.end || DemoData.dateFromDaysAgo(0);
    var summary = (t.summary && t.summary.length) ? t.summary : [
      { label: 'HbA1c', from: '8.5%', to: '6.9%' }
    ];
    return {
      id: certIdFor(patient),
      patientId: patient.id,
      patientName: patient.name,
      age: patient.age,
      condition: t.condition || patient.condition || '',
      periodStart: startISO,
      periodEnd: endISO,
      medicines: meds,
      doctorName: opts.doctorName || 'Dr. Asha Sharma',
      doctorId: opts.doctorId || 'DOC-1001',
      signature: opts.signature || '',
      summary: summary,
      adherence: (patient.adherence && patient.adherence.percent) || 0,
      closingNotes: opts.closingNotes || 'Treatment course completed in the demonstration system. Continue the maintenance plan discussed with your clinician.',
      completionDate: endISO,
      generatedAt: new Date().toISOString(),
      synthetic: true,
      disclaimer: 'DEMONSTRATION CERTIFICATE - Not a medical or legal document.'
    };
  }

  async function generate(patient, opts) {
    var cert = buildFromPatient(patient, opts);
    await Storage.saveCertificate(cert);
    await Storage.saveAuditLog({
      actorId: (opts && opts.doctorId) || 'DOC-1001',
      actorRole: 'doctor',
      action: 'certificate.generated',
      patientId: patient.id,
      message: 'Treatment certificate ' + cert.id + ' generated (SYNTHETIC DEMO DATA).'
    });
    return cert;
  }

  async function ensureSeedCert() {
    var p = await Storage.getPatient('PT-1010');
    if (!p || !p.certId) return null;
    var existing = await Storage.getCertificate(p.certId);
    if (existing) return existing;
    var cert = buildFromPatient(p, { signature: '(signed in demo)' });
    cert.id = p.certId;
    cert.completionDate = p.treatment && p.treatment.end ? p.treatment.end : DemoData.dateFromDaysAgo(5);
    await Storage.saveCertificate(cert);
    return cert;
  }

  async function get(id) {
    var cert = await Storage.getCertificate(id);
    if (cert) return cert;
    if (id === 'CERT-1001') return ensureSeedCert();
    return null;
  }

  function verificationUrl(id) {
    var base = window.location.href.replace(/[^/]*$/, '');
    return base + 'verification.html?id=' + encodeURIComponent(id);
  }

  function render(cert, host) {
    if (!cert) {
      host.innerHTML = '<p class="empty">Certificate not found.</p>';
      return;
    }
    var rows = (cert.summary || []).map(function (s) {
      return '<tr><td>' + App.esc(s.label) + '</td><td>' + App.esc(s.from) + '</td><td>' + App.esc(s.to) + '</td></tr>';
    }).join('');
    var medRows = (cert.medicines || []).map(function (m) {
      return '<tr><td>' + App.esc(m.name) + '</td><td>' + App.esc(m.dose) + '</td><td>' + App.esc(m.schedule) + '</td></tr>';
    }).join('') || '<tr><td colspan="3">No medicines recorded</td></tr>';

    host.innerHTML =
      '<article class="certificate" aria-label="Demonstration certificate">' +
      '<header class="cert-head">' +
      '<div class="cert-mark" aria-hidden="true">VT</div>' +
      '<div><p class="cert-brand">Virtual Patient Digital Twin</p>' +
      '<h1>DEMONSTRATION CERTIFICATE</h1>' +
      '<p class="cert-sub">Not a medical or legal document.</p></div>' +
      '</header>' +
      '<p class="cert-synthetic">SYNTHETIC DEMO DATA · Demo for education only, not medical advice.</p>' +
      '<dl class="cert-grid">' +
      '<div><dt>Certificate ID</dt><dd>' + App.esc(cert.id) + '</dd></div>' +
      '<div><dt>Patient</dt><dd>' + App.esc(cert.patientName) + ' (' + App.esc(cert.patientId) + ')</dd></div>' +
      '<div><dt>Age</dt><dd>' + App.esc(String(cert.age)) + '</dd></div>' +
      '<div><dt>Condition</dt><dd>' + App.esc(cert.condition) + '</dd></div>' +
      '<div><dt>Treatment period</dt><dd>' + App.esc(App.fmtDate(cert.periodStart)) + ' → ' + App.esc(App.fmtDate(cert.periodEnd)) + '</dd></div>' +
      '<div><dt>Completion date</dt><dd>' + App.esc(App.fmtDate(cert.completionDate)) + '</dd></div>' +
      '<div><dt>Adherence</dt><dd>' + App.esc(String(cert.adherence)) + '%</dd></div>' +
      '<div><dt>Doctor</dt><dd>' + App.esc(cert.doctorName) + ' (' + App.esc(cert.doctorId) + ')</dd></div>' +
      '</dl>' +
      '<h2>Final health summary (synthetic)</h2>' +
      '<table class="cert-table"><thead><tr><th>Measure</th><th>Before</th><th>After</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<h2>Medicines &amp; dosages</h2>' +
      '<table class="cert-table"><thead><tr><th>Medicine</th><th>Dose</th><th>Schedule / dosage history</th></tr></thead><tbody>' + medRows + '</tbody></table>' +
      '<p class="cert-notes"><strong>Closing notes:</strong> ' + App.esc(cert.closingNotes) + '</p>' +
      '<div class="cert-sign-row">' +
      '<div class="cert-sign"><span>Doctor signature</span><div class="sig-line">' + App.esc(cert.signature || '') + '</div></div>' +
      '<div class="cert-qr"><canvas id="certQr" width="140" height="140" aria-label="Verification QR code"></canvas>' +
      '<p class="fineprint">Scan to open verification.html?id=' + App.esc(cert.id) + '</p></div>' +
      '</div>' +
      '<footer class="cert-foot">Generated ' + App.esc(App.fmtDate(cert.generatedAt)) +
      ' · This certificate is part of a software demonstration and does not verify a real medical treatment.</footer>' +
      '</article>';

    var cv = host.querySelector('#certQr');
    if (cv && window.QR) {
      try { QR.draw(cv, verificationUrl(cert.id), { scale: 4 }); }
      catch (e) {
        if (cv.parentNode) cv.parentNode.innerHTML = '<p class="fineprint">QR unavailable: ' + App.esc(e.message) + '</p>';
      }
    }
  }

  function urlFor(id) { return 'certificate.html?id=' + encodeURIComponent(id); }

  return {
    buildFromPatient: buildFromPatient,
    generate: generate,
    ensureSeedCert: ensureSeedCert,
    get: get,
    render: render,
    verificationUrl: verificationUrl,
    urlFor: urlFor
  };
})();
