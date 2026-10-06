/*
 * app.js - shared foundation: i18n, theme, connection status, charts,
 *          toasts/modals, demo events and the guided digital-twin demo flow.
 *
 * Demo for education only, not medical advice.
 */
window.App = (function () {
  'use strict';

  /* ================================================================ i18n */
  var I18N = {
    en: {
      tagline: 'Connected wellness intelligence for patients and care teams.',
      patientLogin: 'Patient Login', doctorLogin: 'Doctor Login', caregiverAccess: 'Caregiver Access',
      demoMode: 'Demo Mode', privacy: 'Privacy', about: 'About', limitations: 'Limitations',
      disclaimer: 'Demo for education only, not medical advice.',
      disclaimer2: 'AI suggestions are not medical diagnoses. A qualified healthcare professional must make clinical decisions.',
      dashboard: 'Dashboard', medicines: 'Medicines', timeline: 'Timeline', history: 'History',
      assistant: 'Assistant', settings: 'Settings', logout: 'Log out',
      home: 'Home', triage: 'Triage', auditLog: 'Audit Log', certificates: 'Certificates',
      wellnessScore: 'Wellness Score', riskStatus: 'Risk Status', nextAppointment: 'Next Appointment',
      todayMedicines: "Today's Medicines", heartRate: 'Heart Rate', bloodSugar: 'Blood Sugar',
      spo2: 'SpO2', sleep: 'Sleep', steps: 'Steps', bp: 'Blood Pressure', adherence: 'Medication Adherence',
      online: 'Connected', offline: 'Offline', offlineNote: 'Changes saved locally.',
      pendingSync: 'Pending sync:', syncing: 'Syncing...', syncComplete: 'Sync complete.',
      signIn: 'Sign in', pin: 'PIN', lockNow: 'Lock now', searchPatients: 'Search patients...',
      green: 'GREEN - Stable', yellow: 'YELLOW - Watch', red: 'RED - Act Now',
      theme: 'Theme', language: 'Language', light: 'Light', dark: 'Dark',
      save: 'Save', cancel: 'Cancel', accept: 'Accept', decline: 'Decline',
      synthetic: 'SYNTHETIC DEMO DATA', open: 'Open', close: 'Close', back: 'Back',
      runDemo: 'RUN DIGITAL TWIN DEMO', next: 'Next step', finish: 'Finish',
      sos: 'SOS', bookConsult: 'Book consultation', startConsult: 'Start consultation',
      approveSend: 'Approve & Send', reject: 'Reject', edit: 'Edit',
      exportData: 'Export Demo Data', importData: 'Import Demo Data', deleteData: 'Delete My Data',
      resetDemo: 'Reset Demo', howRiskWorks: 'How the Risk Engine Works',
      noDiagnosis: 'I cannot diagnose a condition. A healthcare professional can interpret your symptoms and test results.',
      cameraOff: 'Camera unavailable. Use manual confirmation instead.',
      voiceUnsupported: 'Voice input is not supported by this browser. Please type your question.',
      localAIConnected: 'Local AI: Connected', localAINotAvailable: 'Local AI: Not available',
      install: 'Install app', emergencyTitle: 'Emergency phrase detected.',
      callingIn: 'Calling for help in 10 seconds. Say CANCEL to stop.',
      emergencyCancelled: 'Emergency cancelled.', emergencyAlert: 'Emergency Alert (SIMULATED)',
      smsSimulated: 'Demo SMS simulated', callSimulated: 'Call initiated (SIMULATED - no real call)',
      evidenceNote: 'This is evidence of adherence behavior, not proof that medicine was swallowed.',
      demoPayment: 'Demo payment gateway - no real transaction occurs.',
      notMedicalDoc: 'Not a medical or legal document.',
      confirmDelete: 'This removes locally stored demo data from this browser.',
      readAdvice: 'Read advice', markUnderstood: 'Mark understood'
    },
    hi: {
      tagline: 'रोगियों और देखभाल टीमों के लिए जुड़ा हुआ वेलनेस इंटेलिजेंस।',
      patientLogin: 'रोगी लॉगिन', doctorLogin: 'डॉक्टर लॉगिन', caregiverAccess: 'देखभालकर्ता पहुँच',
      demoMode: 'डेमो मोड', privacy: 'गोपनीयता', about: 'परिचय', limitations: 'सीमाएँ',
      disclaimer: 'यह केवल शिक्षा के लिए डेमो है, चिकित्सकीय सलाह नहीं।',
      disclaimer2: 'AI सुझाव चिकित्सकीय निदान नहीं हैं। योग्य स्वास्थ्य पेशेवर को ही नैदानिक निर्णय लेना चाहिए।',
      dashboard: 'डैशबोर्ड', medicines: 'दवाइयाँ', timeline: 'टाइमलाइन', history: 'इतिहास',
      assistant: 'सहायक', settings: 'सेटिंग्स', logout: 'लॉग आउट',
      home: 'होम', triage: 'ट्राइएज', auditLog: 'ऑडिट लॉग', certificates: 'प्रमाणपत्र',
      wellnessScore: 'वेलनेस स्कोर', riskStatus: 'जोखिम स्थिति', nextAppointment: 'अगली नियुक्ति',
      todayMedicines: 'आज की दवाइयाँ', heartRate: 'हृदय गति', bloodSugar: 'रक्त शर्करा',
      spo2: 'SpO2', sleep: 'नींद', steps: 'कदम', bp: 'रक्तचाप', adherence: 'दवा पालन',
      online: 'कनेक्टेड', offline: 'ऑफ़लाइन', offlineNote: 'परिवर्तन स्थानीय रूप से सहेजे गए।',
      pendingSync: 'लंबित सिंक:', syncing: 'सिंक हो रहा है...', syncComplete: 'सिंक पूर्ण।',
      signIn: 'साइन इन', pin: 'PIN', lockNow: 'अभी लॉक करें', searchPatients: 'रोगी खोजें...',
      green: 'GREEN - स्थिर', yellow: 'YELLOW - निगरानी', red: 'RED - अभी कार्रवाई',
      theme: 'थीम', language: 'भाषा', light: 'लाइट', dark: 'डार्क',
      save: 'सहेजें', cancel: 'रद्द करें', accept: 'स्वीकारें', decline: 'अस्वीकारें',
      synthetic: 'कृत्रिम डेमो डेटा', open: 'खोलें', close: 'बंद करें', back: 'वापस',
      runDemo: 'डिजिटल ट्विन डेमो चलाएँ', next: 'अगला चरण', finish: 'समाप्त',
      sos: 'SOS', bookConsult: 'परामर्श बुक करें', startConsult: 'परामर्श शुरू करें',
      approveSend: 'अनुमोदित करें और भेजें', reject: 'अस्वीकारें', edit: 'संपादित करें',
      exportData: 'डेमो डेटा निर्यात', importData: 'डेमो डेटा आयात', deleteData: 'मेरा डेटा हटाएँ',
      resetDemo: 'डेमो रीसेट करें', howRiskWorks: 'जोखिम इंजन कैसे काम करता है',
      noDiagnosis: 'मैं किसी स्थिति का निदान नहीं कर सकता। योग्य स्वास्थ्य पेशेवर ही व्याख्या कर सकता है।',
      cameraOff: 'कैमरा उपलब्ध नहीं। मैन्युअल पुष्टि का उपयोग करें।',
      voiceUnsupported: 'इस ब्राउज़र में वॉइस इनपुट उपलब्ध नहीं है। कृपया टाइप करें।',
      localAIConnected: 'स्थानीय AI: कनेक्टेड', localAINotAvailable: 'स्थानीय AI: उपलब्ध नहीं',
      install: 'ऐप इंस्टॉल करें', emergencyTitle: 'आपातकालीन वाक्यांश मिला।',
      callingIn: '10 सेकंड में सहायता के लिए कॉल किया जा रहा है। रोकने के लिए CANCEL कहें।',
      emergencyCancelled: 'आपातकाल रद्द किया गया।', emergencyAlert: 'आपातकालीन अलर्ट (SIMULATED)',
      smsSimulated: 'डेमो SMS सिम्युलेटेड', callSimulated: 'कॉल शुरू (SIMULATED - कोई वास्तविक कॉल नहीं)',
      evidenceNote: 'यह सेवन व्यवहार का प्रमाण है, दवा निगलने का प्रमाण नहीं।',
      demoPayment: 'डेमो पेमेंट गेटवे - कोई वास्तविक लेनदेन नहीं होता।',
      notMedicalDoc: 'चिकित्सा या कानूनी दस्तावेज़ नहीं।',
      confirmDelete: 'यह इस ब्राउज़र में संग्रहीत डेमो डेटा हटा देगा।',
      readAdvice: 'सल्हा पढ़ें', markUnderstood: 'समझ गया'
    },
    mr: {
      tagline: 'रुग्ण आणि काळजी टीमांसाठी जोडलेली आरोग्य बुद्धिमत्ता।',
      patientLogin: 'रुग्ण लॉगिन', doctorLogin: 'डॉक्टर लॉगिन', caregiverAccess: 'काळजीकर्ता प्रवेश',
      demoMode: 'डेमो मोड', privacy: 'गोपनीयता', about: 'परिचय', limitations: 'मर्यादा',
      disclaimer: 'हा केवळ शिक्षणासाठी डेमो आहे, वैद्यकीय सल्ला नाही।',
      disclaimer2: 'AI सूचना नैदान्यिक निदान नाहीत. पात्र आरोग्यव्यावसायिकाच पात्र निर्णय घ्यावे.',
      dashboard: 'डॅशबोर्ड', medicines: 'औषधे', timeline: 'टाइमलाइन', history: 'इतिहास',
      assistant: 'सहाय्यक', settings: 'सेटिंग्ज', logout: 'लॉग आउट',
      home: 'होम', triage: 'ट्रायेज', auditLog: 'ऑडिट लॉग', certificates: 'प्रमाणपत्रे',
      wellnessScore: 'वेलनेस स्कोर', riskStatus: 'धोका स्थिती', nextAppointment: 'पुढची अपॉइंटमेंट',
      todayMedicines: 'आजची औषधे', heartRate: 'हृदयाचा ताल', bloodSugar: 'रक्तशर्करा',
      spo2: 'SpO2', sleep: 'झोप', steps: 'टप्पे', bp: 'रक्तदाब', adherence: 'औषध पाळणे',
      online: 'कनेक्टेड', offline: 'ऑफलाइन', offlineNote: 'बदल स्थानिकरित्या जतन केले.',
      pendingSync: 'प्रलंबित सिंक:', syncing: 'सिंक होत आहे...', syncComplete: 'सिंक पूर्ण.',
      signIn: 'साइन इन', pin: 'PIN', lockNow: 'आत्ता लॉक करा', searchPatients: 'रुग्ण शोधा...',
      green: 'GREEN - स्थिर', yellow: 'YELLOW - लक्ष ठेवा', red: 'RED - आत्ता कृती',
      theme: 'थीम', language: 'भाषा', light: 'लाइट', dark: 'डार्क',
      save: 'जतन करा', cancel: 'रद्द करा', accept: 'स्वीकारा', decline: 'नकारा',
      synthetic: 'नमुना डेमो डेटा', open: 'उघडा', close: 'बंद करा', back: 'मागे',
      runDemo: 'डिजिटल ट्विन डेमो चालवा', next: 'पुढची पायरी', finish: 'संपले',
      sos: 'SOS', bookConsult: 'सल्ला बुक करा', startConsult: 'सल्ला सुरू करा',
      approveSend: 'मान्य करा आणि पाठवा', reject: 'नकारा', edit: 'संपादित करा',
      exportData: 'डेमो डेटा निर्यात', importData: 'डेमो डेटा आयात', deleteData: 'माझा डेटा हटवा',
      resetDemo: 'डेमो रीसेट करा', howRiskWorks: 'धोका इंजिन कसे काम करते',
      noDiagnosis: 'मी निदान करू शकत नाही. पात्र आरोग्यव्यावसायिकच व्याख्या करू शकतो.',
      cameraOff: 'कॅमेरा उपलब्ध नाही. मॅन्युअल पुष्टी वापरा.',
      voiceUnsupported: 'या ब्राउझरमध्ये वॉइस इनपुट उपलब्ध नाही. कृपया टाइप करा.',
      localAIConnected: 'स्थानिक AI: कनेक्टेड', localAINotAvailable: 'स्थानिक AI: उपलब्ध नाही',
      install: 'अ‍ॅप इन्स्टॉल करा', emergencyTitle: 'आणीबाणी संदर्भ आढळला.',
      callingIn: '10 सेकंदात मदतीसाठी कॉल केला जात आहे. थांबवण्यासाठी CANCEL म्हणा.',
      emergencyCancelled: 'आणीबाणी रद्द केली.', emergencyAlert: 'आणीबाणी अलर्ट (SIMULATED)',
      smsSimulated: 'डेमो SMS सिम्युलेटेड', callSimulated: 'कॉल सुरू (SIMULATED - खरी कॉल नाही)',
      evidenceNote: 'हा सेवनाचा वर्तनाचा पुरावा आहे, औषध गिळल्याचा पुरावा नाही.',
      demoPayment: 'डेमो पेमेंट गेटवे - कोणतीही खरी व्यवहार होत नाही.',
      notMedicalDoc: 'वैद्यकीय किंवा कायदेशीर दस्तऐवज नाही.',
      confirmDelete: 'यामुळे या ब्राउझरमधील डेमो डेटा हटवला जाईल.',
      readAdvice: 'सल्ला वाचा', markUnderstood: 'समजले'
    }
  };
  var lang = null;

  function t(key, vars) {
    var table = I18N[lang || 'en'] || I18N.en;
    var s = table[key] || I18N.en[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function applyI18n(root) {
    root = root || document;
    var nodes = root.querySelectorAll ? root.querySelectorAll('[data-i18n]') : [];
    Array.prototype.forEach.call(nodes, function (n) {
      n.textContent = t(n.getAttribute('data-i18n'));
    });
    var ph = root.querySelectorAll ? root.querySelectorAll('[data-i18n-ph]') : [];
    Array.prototype.forEach.call(ph, function (n) { n.setAttribute('placeholder', t(n.getAttribute('data-i18n-ph'))); });
    var al = root.querySelectorAll ? root.querySelectorAll('[data-i18n-aria]') : [];
    Array.prototype.forEach.call(al, function (n) { n.setAttribute('aria-label', t(n.getAttribute('data-i18n-aria'))); });
    var dis = root.querySelectorAll ? root.querySelectorAll('[data-disclaimer]') : [];
    Array.prototype.forEach.call(dis, function (n) {
      n.innerHTML = '<strong>' + esc(t('disclaimer')) + '</strong><br>' + esc(t('disclaimer2')) +
        '<br><span class="small">SYNTHETIC DEMO DATA · This prototype is not a medical device and must not be used for diagnosis, treatment, emergency decisions or medication changes.</span>';
    });
    document.documentElement.setAttribute('lang', lang || 'en');
  }
  function setLanguage(next) {
    if (!I18N[next]) next = 'en';
    lang = next;
    Storage.setSetting('language', next);
    applyI18n(document);
    document.dispatchEvent(new CustomEvent('vpdt:lang'));
  }

  /* =============================================================== theme */
  function systemTheme() {
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { return 'light'; }
  }
  function applyTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    var btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = mode === 'dark' ? '☀ Light' : '🌙 Dark';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', mode === 'dark' ? '#0b1f1c' : '#111111');
  }
  function setTheme(mode) {
    Storage.setSetting('theme', mode);
    applyTheme(mode);
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    setTheme(cur === 'dark' ? 'light' : 'dark');
  }
  function initTheme() {
    var saved = Storage.getSetting('theme', null);
    applyTheme(saved || systemTheme());
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
        if (!Storage.getSetting('theme', null)) applyTheme(e.matches ? 'dark' : 'light');
      });
    } catch (e) { /* older browsers */ }
  }

  /* ============================================================== dom help */
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function setText(id, text) { var n = document.getElementById(id); if (n) n.textContent = text; }
  function html(id, markup) { var n = document.getElementById(id); if (n) n.innerHTML = markup; }

  function fmtDate(iso) {
    if (!iso) return '-';
    var d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso);
    if (isNaN(d)) return String(iso);
    try {
      return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : lang === 'mr' ? 'mr-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) { return d.toISOString().slice(0, 10); }
  }
  function fmtTime(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d)) return String(iso);
    try { return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }

  /* ---- medicine schedule helpers (shared by doctor / patient / caregiver) ---- */
  function medTimes(m) {
    return ((m && m.times) || []).join(' · ');
  }
  function medFrequency(m) {
    if (!m) return '';
    if (m.frequency) return m.frequency;
    var n = ((m.times) || []).length;
    return n ? (n + '× daily') : '';
  }
  function medDateRange(m) {
    if (!m) return '';
    var start = m.startDate ? 'From ' + fmtDate(m.startDate) : '';
    var end = m.endDate ? 'to ' + fmtDate(m.endDate) : '';
    if (start && end) return start + ' ' + end;
    if (start) return start;
    if (end) return 'Until ' + fmtDate(m.endDate);
    return 'No date set';
  }
  function medSchedule(m) {
    if (!m) return '';
    var t = m.scheduleType;
    if (t === 'sos') return 'As needed (SOS)';
    if (t === 'alternate') return 'Every other day';
    if (t === 'specific') return m.scheduleDays ? 'On ' + m.scheduleDays : 'Specific days';
    if (t === 'daily') return 'Every day';
    return m.schedule || 'Every day';
  }
  function greeting() {
    var h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  /* ============================================================== toasts */
  function toast(msg, type) {
    var wrap = document.getElementById('toastWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toastWrap';
      wrap.className = 'toast-wrap';
      wrap.setAttribute('role', 'status');
      wrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(wrap);
    }
    var el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.appendChild(document.createTextNode(msg));
    wrap.appendChild(el);
    setTimeout(function () { el.classList.add('show'); }, 20);
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, type === 'error' ? 6000 : 4000);
    return el;
  }

  /* ========================================================= modal helpers */
  function modal(opts) {
    return new Promise(function (resolve) {
      var prev = document.activeElement;
      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      var box = document.createElement('div');
      box.className = 'modal-box';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', opts.title || 'Dialog');

      var h = document.createElement('h3');
      h.className = 'modal-title';
      h.textContent = opts.title || '';
      box.appendChild(h);

      var body = document.createElement('div');
      body.className = 'modal-body';
      if (opts.bodyNode) body.appendChild(opts.bodyNode);
      else {
        String(opts.body || '').split('\n').forEach(function (line) {
          var p = document.createElement('p');
          p.textContent = line;
          body.appendChild(p);
        });
      }
      box.appendChild(body);

      var actions = document.createElement('div');
      actions.className = 'modal-actions';
      var closed = false;
      function close(val) {
        if (closed) return;
        closed = true;
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        document.removeEventListener('keydown', onKey);
        if (prev && prev.focus) try { prev.focus(); } catch (e) { /* ignore */ }
        resolve(val);
      }
      function onKey(e) {
        if (e.key === 'Escape' && !opts.blockEscape) close(opts.cancelValue !== undefined ? opts.cancelValue : false);
        if (e.key === 'Tab') {
          var f = box.querySelectorAll('button, [href], input, select, textarea');
          if (!f.length) return;
          var first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
      (opts.actions || [{ label: 'OK', value: true, primary: true }]).forEach(function (a) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn ' + (a.primary ? 'btn-primary' : a.danger ? 'btn-danger' : 'btn-ghost');
        b.textContent = a.label;
        b.addEventListener('click', function () {
          if (a.onClick) {
            var r = a.onClick(box);
            if (r === false) return;
            close(r !== undefined ? r : a.value);
          } else close(a.value);
        });
        actions.appendChild(b);
      });
      box.appendChild(actions);
      overlay.appendChild(box);
      overlay.addEventListener('mousedown', function (e) { if (e.target === overlay && !opts.blockEscape) close(opts.cancelValue !== undefined ? opts.cancelValue : false); });
      document.body.appendChild(overlay);
      document.addEventListener('keydown', onKey);
      var focusTarget = box.querySelector('input, textarea, button');
      if (focusTarget) focusTarget.focus();
    });
  }

  function confirmDialog(message, opts) {
    opts = opts || {};
    var bodyNode = null;
    if (opts.typeToConfirm) {
      bodyNode = document.createElement('div');
      var p = document.createElement('p');
      p.textContent = message;
      p.style.whiteSpace = 'pre-line';
      var lab = document.createElement('label');
      lab.setAttribute('for', 'confirmPhrase');
      lab.style.display = 'block';
      lab.style.fontWeight = '700';
      lab.style.margin = '.7rem 0 .3rem';
      lab.textContent = 'Type ' + opts.typeToConfirm + ' to confirm';
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.id = 'confirmPhrase';
      inp.autocomplete = 'off';
      inp.spellcheck = false;
      inp.setAttribute('aria-label', 'Type ' + opts.typeToConfirm + ' to confirm');
      var hint = document.createElement('span');
      hint.className = 'hint';
      hint.textContent = 'This phrase is required so a destructive or high-risk action is never triggered by accident (demo safety rule).';
      bodyNode.appendChild(p);
      bodyNode.appendChild(lab);
      bodyNode.appendChild(inp);
      bodyNode.appendChild(hint);
    }
    return modal({
      title: opts.title || 'Please confirm',
      body: bodyNode ? undefined : message,
      bodyNode: bodyNode,
      blockEscape: !!opts.typeToConfirm,
      cancelValue: false,
      actions: [
        { label: opts.cancelLabel || t('cancel'), value: false },
        {
          label: opts.confirmLabel || 'Confirm', primary: !opts.danger, danger: opts.danger,
          onClick: function (box) {
            if (opts.typeToConfirm) {
              var input = box.querySelector('input');
              if (!input || input.value.trim().toUpperCase() !== opts.typeToConfirm.toUpperCase()) {
                toast('Type ' + opts.typeToConfirm + ' to confirm.', 'error');
                return false;
              }
            }
            return true;
          }
        }
      ]
    });
  }

  /* =================================================== connection + sync */
  var simulatedOffline = false;
  function offlineNow() { return simulatedOffline || navigator.onLine === false; }

  function updateConnectionUI() {
    var off = offlineNow();
    $$('[data-connection]').forEach(function (n) {
      n.className = 'conn-badge ' + (off ? 'conn-offline' : 'conn-online');
      n.innerHTML = '<span class="dot" aria-hidden="true"></span>' + (off ? '🟠 ' + t('offline') : '🟢 ' + t('online'));
    });
    var pend = Storage.getPendingSyncItems ? null : null;
    Storage.getPendingSyncItems().then(function (items) {
      $$('[data-pending-sync]').forEach(function (n) {
        if (off && items.length) n.textContent = t('pendingSync') + ' ' + items.length + ' • ' + t('offlineNote');
        else n.textContent = items.length ? t('pendingSync') + ' ' + items.length : '';
        n.hidden = !n.textContent;
      });
    }).catch(function () { /* ignore */ });
  }

  async function syncNow() {
    if (offlineNow()) {
      toast(t('offline') + ' - ' + t('offlineNote'), 'info');
      updateConnectionUI();
      return false;
    }
    var pending = await Storage.getPendingSyncItems();
    $$('[data-sync-status]').forEach(function (n) { n.textContent = t('syncing'); });
    if (!pending.length) {
      $$('[data-sync-status]').forEach(function (n) { n.textContent = ''; });
      updateConnectionUI();
      return true;
    }
    await new Promise(function (r) { setTimeout(r, 900); });
    await Storage.markSynced(pending.map(function (i) { return i.id; }));
    $$('[data-sync-status]').forEach(function (n) { n.textContent = t('syncComplete'); });
    toast(t('syncComplete') + ' (simulated local sync - no server)', 'success');
    updateConnectionUI();
    setTimeout(function () {
      $$('[data-sync-status]').forEach(function (n) { if (n.textContent === t('syncComplete')) n.textContent = ''; });
    }, 4000);
    return true;
  }

  function setSimulatedOffline(v) {
    simulatedOffline = !!v;
    window.__vpdtOffline = simulatedOffline;
    if (!simulatedOffline) {
      toast('Connection restored. ' + t('syncing'), 'info');
      syncNow();
    } else {
      toast(t('offline') + ' - ' + t('offlineNote'), 'info');
    }
    updateConnectionUI();
    document.dispatchEvent(new CustomEvent('vpdt:connection'));
  }

  function initConnection() {
    window.addEventListener('online', function () { if (!simulatedOffline) { updateConnectionUI(); syncNow(); } });
    window.addEventListener('offline', function () { updateConnectionUI(); });
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-sync-now]') : null;
      if (b) { e.preventDefault(); syncNow(); }
      var s = e.target.closest ? e.target.closest('[data-toggle-offline]') : null;
      if (s) { e.preventDefault(); setSimulatedOffline(!simulatedOffline); }
    });
    updateConnectionUI();
    setInterval(updateConnectionUI, 8000);
  }

  /* ============================================================== charts */
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return v && v.trim() ? v.trim() : fallback;
  }

  function prepCanvas(canvas) {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth || canvas.parentNode.clientWidth || 640;
    var h = canvas.clientHeight || 240;
    canvas.width = Math.max(10, Math.floor(w * dpr));
    canvas.height = Math.max(10, Math.floor(h * dpr));
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  function niceRange(min, max) {
    if (min === max) { min -= 5; max += 5; }
    var span = max - min;
    var pad = span * 0.12;
    min -= pad; max += pad;
    var step = Math.pow(10, Math.floor(Math.log(max - min) / Math.LN10));
    if ((max - min) / step > 8) step *= 2;
    if ((max - min) / step < 3) step /= 2;
    var lo = Math.floor(min / step) * step;
    var hi = Math.ceil(max / step) * step;
    return { lo: lo, hi: hi, step: step };
  }

  function drawLegend(ctx, series, x, y) {
    var cursor = x;
    ctx.font = '12px system-ui, sans-serif';
    series.forEach(function (s) {
      ctx.fillStyle = s.color;
      ctx.fillRect(cursor, y - 8, 12, 4);
      ctx.fillStyle = cssVar('--muted', '#575757');
      ctx.fillText(s.label, cursor + 16, y - 1);
      cursor += 16 + ctx.measureText(s.label).width + 16;
    });
  }

  function lineChart(canvas, opts) {
    if (!canvas || !canvas.getContext) return;
    var p = prepCanvas(canvas);
    var ctx = p.ctx, w = p.w, h = p.h;
    ctx.clearRect(0, 0, w, h);
    var series = opts.series || [];
    if (!series.length || !series[0].data.length) {
      ctx.fillStyle = cssVar('--muted', '#575757');
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText('No data available', 16, 30);
      return;
    }
    var labels = opts.labels || [];
    var all = [];
    series.forEach(function (s) { all = all.concat(s.data); });
    var range = niceRange(Math.min.apply(null, all), Math.max.apply(null, all));
    if (typeof opts.yMin === 'number') range.lo = opts.yMin;
    if (typeof opts.yMax === 'number') range.hi = opts.yMax;

    var padL = 46, padR = 12, padT = 14, padB = 44;
    var plotW = w - padL - padR, plotH = h - padT - padB;

    // grid + y labels
    ctx.strokeStyle = cssVar('--grid', '#e4e4e4');
    ctx.fillStyle = cssVar('--muted', '#575757');
    ctx.font = '11px system-ui, sans-serif';
    ctx.lineWidth = 1;
    var steps = Math.max(2, Math.round((range.hi - range.lo) / range.step));
    for (var i = 0; i <= steps; i++) {
      var val = range.lo + (range.hi - range.lo) * (i / steps);
      var y = padT + plotH - ((val - range.lo) / (range.hi - range.lo)) * plotH;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(String(Math.round(val * 10) / 10), padL - 6, y + 4);
    }
    // x labels
    ctx.textAlign = 'center';
    var n = series[0].data.length;
    var every = Math.max(1, Math.ceil(n / 7));
    for (var j = 0; j < n; j++) {
      if (j % every !== 0 && j !== n - 1) continue;
      var x = padL + (n === 1 ? plotW / 2 : (j / (n - 1)) * plotW);
      ctx.fillText(labels[j] !== undefined ? String(labels[j]) : String(j + 1), x, h - 24);
    }
    if (opts.unit) {
      ctx.textAlign = 'left';
      ctx.fillText(opts.unit, padL, h - 6);
    }
    // series
    series.forEach(function (s, si) {
      ctx.beginPath();
      s.data.forEach(function (v, j) {
        var x = padL + (n === 1 ? plotW / 2 : (j / (n - 1)) * plotW);
        var y = padT + plotH - ((v - range.lo) / (range.hi - range.lo)) * plotH;
        if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.stroke();
      // area fill for single series
      if (series.length === 1 && opts.fill !== false) {
        ctx.lineTo(padL + plotW, padT + plotH);
        ctx.lineTo(padL, padT + plotH);
        ctx.closePath();
        ctx.fillStyle = s.color + '22';
        ctx.fill();
      }
      // dots
      s.data.forEach(function (v, j) {
        var x = padL + (n === 1 ? plotW / 2 : (j / (n - 1)) * plotW);
        var y = padT + plotH - ((v - range.lo) / (range.hi - range.lo)) * plotH;
        ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = s.color; ctx.fill();
      });
    });
    if (opts.legend !== false && series.length) drawLegend(ctx, series, padL, h - 6);
  }

  function barChart(canvas, opts) {
    if (!canvas || !canvas.getContext) return;
    var p = prepCanvas(canvas);
    var ctx = p.ctx, w = p.w, h = p.h;
    ctx.clearRect(0, 0, w, h);
    var labels = opts.labels || [];
    var data = opts.data || [];
    if (!data.length) {
      ctx.fillStyle = cssVar('--muted', '#575757');
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText('No data available', 16, 30);
      return;
    }
    var padL = 46, padR = 12, padT = 14, padB = 44;
    var plotW = w - padL - padR, plotH = h - padT - padB;
    var range = niceRange(0, Math.max.apply(null, data));
    ctx.strokeStyle = cssVar('--grid', '#e4e4e4');
    ctx.fillStyle = cssVar('--muted', '#575757');
    ctx.font = '11px system-ui, sans-serif';
    var steps = 4;
    for (var i = 0; i <= steps; i++) {
      var val = range.lo + (range.hi - range.lo) * (i / steps);
      var y = padT + plotH - ((val - range.lo) / (range.hi - range.lo)) * plotH;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(String(Math.round(val)), padL - 6, y + 4);
    }
    var bw = plotW / data.length;
    var color = opts.color || cssVar('--brand', '#111111');
    data.forEach(function (v, j) {
      var bh = ((v - range.lo) / (range.hi - range.lo)) * plotH;
      var x = padL + j * bw + bw * 0.18;
      ctx.fillStyle = color;
      ctx.beginPath();
      var rr = Math.min(6, bw * 0.3);
      var y0 = padT + plotH - bh, y1 = padT + plotH;
      if (ctx.roundRect) { ctx.roundRect(x, y0, bw * 0.64, bh, [rr, rr, 0, 0]); }
      else ctx.rect(x, y0, bw * 0.64, bh);
      ctx.fill();
      ctx.fillStyle = cssVar('--muted', '#575757');
      ctx.textAlign = 'center';
      ctx.fillText(String(labels[j] !== undefined ? labels[j] : j + 1), x + bw * 0.32, h - 24);
    });
    if (opts.unit) { ctx.textAlign = 'left'; ctx.fillText(opts.unit, padL, h - 6); }
  }

  function gauge(canvas, score) {
    if (!canvas || !canvas.getContext) return;
    var p = prepCanvas(canvas);
    var ctx = p.ctx, w = p.w, h = p.h;
    ctx.clearRect(0, 0, w, h);
    var cx = w / 2, cy = h * 0.72, r = Math.min(w / 2 - 12, h * 0.62);
    var start = Math.PI, end = 0;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.strokeStyle = cssVar('--track', '#e8e8e8');
    ctx.beginPath(); ctx.arc(cx, cy, r, start, end); ctx.stroke();
    var col = score >= 70 ? '#1f9d55' : score >= 40 ? '#e0a800' : '#d64545';
    ctx.strokeStyle = col;
    ctx.beginPath(); ctx.arc(cx, cy, r, start, start + (end - start) * (score / 100)); ctx.stroke();
    ctx.fillStyle = cssVar('--ink', '#141414');
    ctx.textAlign = 'center';
    ctx.font = 'bold ' + Math.round(r * 0.55) + 'px system-ui, sans-serif';
    ctx.fillText(String(score), cx, cy + r * 0.12);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = cssVar('--muted', '#575757');
    ctx.fillText('/ 100', cx, cy + r * 0.42);
  }

  var redrawHandlers = [];
  function registerChartRedraw(fn) { redrawHandlers.push(fn); }
  function redrawCharts() { redrawHandlers.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } }); }
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(redrawCharts, 220);
  });
  document.addEventListener('vpdt:lang', function () { setTimeout(redrawCharts, 30); });

  /* =============================================================== badges */
  function riskBadge(level, labelOverride) {
    var text = labelOverride || (level === 'red' ? 'RED - Act Now' : level === 'yellow' ? 'YELLOW - Watch' : 'GREEN - Stable');
    var emoji = level === 'red' ? '🔴' : level === 'yellow' ? '🟡' : '🟢';
    return '<span class="risk-badge risk-' + level + '">' + emoji + ' <span>' + esc(text) + '</span></span>';
  }

  /* =============================================================== audio */
  var audioCtx = null;
  function beep(kind) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var freq = kind === 'alarm' ? 660 : kind === 'sos' ? 440 : 880;
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.value = 0.0001;
      o.connect(g); g.connect(audioCtx.destination);
      var now = audioCtx.currentTime;
      g.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      o.start(now); o.stop(now + 0.35);
      // try the bundled wav as well (falls back silently)
      var snd = kind === 'alarm' ? 'assets/sounds/alarm.wav' : kind === 'sos' ? 'assets/sounds/sos.wav' : 'assets/sounds/notify.wav';
      var a = new Audio(snd); a.volume = 0.35; a.play().catch(function () { /* autoplay blocked */ });
    } catch (e) { /* never crash the app over audio */ }
  }

  /* ========================================================= demo events */
  function patientIdForTests() { return Storage.getSetting('testPatientId', 'PT-1004'); }

  async function triggerDemoEvent(type) {
    var pid = patientIdForTests();
    var p = await Storage.getPatient(pid);
    if (!p) { toast('Demo patient not found. Reset the demo first.', 'error'); return; }
    var today = p.wearableData && p.wearableData.length ? p.wearableData[p.wearableData.length - 1] : null;
    var alert = null;
    var vital = null;
    var msg = '';

    if (type === 'highGlucose') {
      if (today) today.bloodSugar = 285;
      p.labs.bloodGlucose = p.labs.bloodGlucose || { label: 'Blood glucose (random)', unit: 'mg/dL' };
      p.labs.bloodGlucose.value = 285; p.labs.bloodGlucose.daysAgo = 0; p.labs.bloodGlucose.date = DemoData.dateFromDaysAgo(0);
      vital = { patientId: pid, type: 'glucose', value: 285, unit: 'mg/dL', note: 'Synthetic test event' };
      alert = { patientId: pid, level: 'red', title: 'Repeated elevated blood glucose detected', reason: 'Synthetic demo reading of 285 mg/dL crossed the demo threshold of 180 mg/dL.', action: 'Doctor review required.', status: 'open', synthetic: true };
      msg = 'Synthetic demonstration alert: high glucose event generated for ' + pid + '.';
    } else if (type === 'highBP') {
      if (today) { today.systolicBP = 178; today.diastolicBP = 106; today.restingHeartRate = 92; today.heartRate = 98; }
      p.labs.systolicBP = p.labs.systolicBP || { label: 'Systolic BP', unit: 'mmHg' };
      p.labs.systolicBP.value = 178; p.labs.systolicBP.daysAgo = 0;
      p.labs.diastolicBP = p.labs.diastolicBP || { label: 'Diastolic BP', unit: 'mmHg' };
      p.labs.diastolicBP.value = 106; p.labs.diastolicBP.daysAgo = 0;
      vital = { patientId: pid, type: 'bp', value: '178/106', unit: 'mmHg', note: 'Synthetic test event' };
      alert = { patientId: pid, level: 'red', title: 'Blood pressure trend increased', reason: 'Synthetic demo BP 178/106 mmHg crossed the configured demo rule threshold.', action: 'Doctor review required.', status: 'open', synthetic: true };
      msg = 'Synthetic demonstration alert: high BP event generated for ' + pid + '.';
    } else if (type === 'lowSpo2') {
      if (today) { today.spo2 = 89; today.respiratoryRate = 27; today.symptoms = (today.symptoms || []).concat(['breathless at rest (synthetic)']); }
      p.labs.spo2 = p.labs.spo2 || { label: 'SpO2', unit: '%' };
      p.labs.spo2.value = 89; p.labs.spo2.daysAgo = 0;
      vital = { patientId: pid, type: 'spo2', value: 89, unit: '%', note: 'Synthetic test event' };
      alert = { patientId: pid, level: 'red', title: 'Low SpO2 detected', reason: 'Synthetic demo reading of 89% is below the demo threshold of 92%.', action: 'Doctor review required. Please contact a qualified healthcare professional for a real emergency.', status: 'open', synthetic: true };
      msg = 'Synthetic demonstration alert: low SpO2 event generated for ' + pid + '.';
    } else if (type === 'missedMed') {
      var med = (p.medicines || [])[0];
      if (!med) { toast('This patient has no scheduled medicines in the demo.', 'error'); return; }
      var log = await Storage.saveMedicationLog({
        patientId: pid, medicineId: med.id, medicineName: med.name,
        scheduledTime: new Date().toISOString(), status: 'missed', source: 'test', confidence: 1
      });
      await Storage.saveAuditLog({ actorId: 'test-panel', actorRole: 'system', action: 'medication.missed', patientId: pid, message: 'Synthetic missed-dose event for ' + med.name });
      toast('Synthetic missed dose recorded for ' + med.name + '.', 'info');
      document.dispatchEvent(new CustomEvent('vpdt:data'));
      return;
    } else if (type === 'emergency') {
      alert = { patientId: pid, level: 'red', title: 'Emergency phrase detected (SIMULATED)', reason: 'Demo wake phrase or SOS button triggered a simulated emergency alert.', action: 'SIMULATED SMS to emergency contact + SIMULATED call. No real call or SMS was made.', status: 'open', synthetic: true, simulated: true };
      msg = 'Simulated emergency alert created for ' + pid + '.';
    }

    if (today) p.wearableData[p.wearableData.length - 1] = today;
    await Storage.savePatient(p);
    if (vital) await Storage.saveVital(vital);
    if (alert) await Storage.saveAlert(alert);
    await Storage.saveAuditLog({ actorId: 'test-panel', actorRole: 'system', action: 'demo.event', patientId: pid, message: msg + ' SYNTHETIC DEMO DATA.' });
    toast(msg, 'warning');
    beep(type === 'lowSpo2' || type === 'emergency' ? 'alarm' : 'notify');
    document.dispatchEvent(new CustomEvent('vpdt:data'));
  }

  async function resetDemoData() {
    var ok = await confirmDialog(
      'Reset Demo\n\nThis restores the original synthetic dataset and removes your local changes, logs, alerts and certificates from this browser.',
      { title: 'Reset Demo', danger: true, confirmLabel: 'Reset Demo' }
    );
    if (!ok) return false;
    await DemoData.resetDemo();
    Storage.setSetting('demoFlow', null);
    await Storage.saveAuditLog({ actorId: 'user', actorRole: 'system', action: 'demo.reset', patientId: null, message: 'Demo reset to original synthetic dataset.' });
    toast('Demo reset. Original synthetic dataset restored.', 'success');
    document.dispatchEvent(new CustomEvent('vpdt:data'));
    return true;
  }

  /* ================================================= guided demo story */
  var DemoFlow = {
    steps: [
      { title: 'STEP 1 - Wearable / EHR data arrives', text: 'Synthetic wearable readings and EHR records for Synthetic Patient 04 (PT-1004) are loaded into the digital twin.', page: 'index' },
      { title: 'STEP 2 - Risk engine analyzes', text: 'The rule-based demo risk engine scores glucose, BP, sleep, activity, HRV and adherence.', page: 'index' },
      { title: 'STEP 3 - Patient becomes RED', text: 'A synthetic high-glucose event is injected. The demo risk level changes to RED - Act Now.', page: 'index' },
      { title: 'STEP 4 - Doctor dashboard receives alert', text: 'A synthetic alert is created and appears in the doctor dashboard triage list.', page: 'doctor' },
      { title: 'STEP 5 - Doctor opens patient profile', text: 'Open Synthetic Patient 04 in the triage list.', page: 'doctor' },
      { title: 'STEP 6 - EHR + wearables + graphs + risk explanation', text: 'Review demographics, labs, 30-day wearable charts and the explainable risk breakdown.', page: 'doctor' },
      { title: 'STEP 7 - System suggests advice', text: 'The rule engine proposes an advice template. It stays a draft until a human approves it.', page: 'doctor' },
      { title: 'STEP 8 - Doctor edits and approves advice', text: 'Click "Approve & Send" - high-risk advice always requires explicit human approval.', page: 'doctor' },
      { title: 'STEP 9 - Patient receives advice', text: 'Open the patient dashboard: "New advice from Dr. Asha Sharma" is visible.', page: 'patient' },
      { title: 'STEP 10 - Patient can read, acknowledge, book', text: 'Read advice, mark understood, or book a consultation.', page: 'patient' }
    ],
    state: function () { return Storage.getSetting('demoFlow', null); },
    save: function (s) { Storage.setSetting('demoFlow', s); },
    start: function () {
      DemoFlow.save({ active: true, step: 0, startedAt: Date.now() });
      DemoFlow.run(0);
    },
    stop: function () {
      DemoFlow.save({ active: false, step: -1 });
      var ov = document.getElementById('demoOverlay');
      if (ov) ov.remove();
    },
    isActive: function () { var s = DemoFlow.state(); return !!(s && s.active); },
    currentStep: function () { var s = DemoFlow.state(); return s ? s.step : -1; },
    run: async function (stepIndex) {
      var s = DemoFlow.state() || { active: true, step: 0 };
      s.step = stepIndex;
      DemoFlow.save(s);
      var step = DemoFlow.steps[stepIndex];
      if (!step) { DemoFlow.stop(); return; }
      // perform the real data side-effects of each step
      try {
        await DemoFlow.execute(stepIndex);
      } catch (e) {
        toast('Demo step issue: ' + (e && e.message ? e.message : 'unknown'), 'error');
      }
      var currentPage = Storage.getSetting('currentPage', 'index');
      if (step.page !== 'index' && step.page !== currentPage) {
        Storage.setSetting('demoFlowNext', stepIndex + 1);
        window.location.href = step.page + '.html?demo=1';
        return;
      }
      DemoFlow.showOverlay(stepIndex);
      document.dispatchEvent(new CustomEvent('vpdt:demoStep', { detail: { step: stepIndex } }));
    },
    execute: async function (i) {
      var pid = 'PT-1004';
      if (i === 1) {
        var p = await Storage.getPatient(pid);
        if (p) { DemoFlow._lastAssessment = Risk.assess(p, {}); }
      } else if (i === 2) {
        await triggerDemoEvent('highGlucose');
      } else if (i === 3 || i === 4 || i === 5) {
        // alert already created in step 3; ensure it exists for the doctor view
        var alerts = await Storage.getAlerts(pid);
        var has = alerts.some(function (a) { return a.level === 'red' && a.status === 'open'; });
        if (!has && i >= 3) await triggerDemoEvent('highGlucose');
      } else if (i === 7) {
        var p7 = await Storage.getPatient(pid);
        var risk = Risk.assess(p7, {});
        var draft = {
          patientId: pid, doctorId: 'DOC-1001', doctorName: 'Dr. Asha Sharma',
          template: 'High glucose after meals',
          text: 'Synthetic demo draft: please walk 20 minutes after dinner, review your meal plan, and confirm your evening Metformin dose. We will review your readings at the next visit.',
          status: 'draft', aiDraft: true, riskAtDraft: risk.score
        };
        await Storage.saveAdvice(draft);
        await Storage.saveAuditLog({ actorId: 'system', actorRole: 'ai-draft', action: 'advice.draft', patientId: pid, message: 'AI-style draft prepared for human approval (never auto-sent).' });
      }
    },
    continueOnLoad: function (page) {
      var qs = new URLSearchParams(window.location.search);
      var next = Storage.getSetting('demoFlowNext', null);
      if (qs.get('demo') === '1' && next !== null && next !== undefined) {
        Storage.removeSetting('demoFlowNext');
        setTimeout(function () { DemoFlow.run(Number(next)); }, 700);
      } else if (DemoFlow.isActive() && Storage.getSetting('currentPage') === page) {
        setTimeout(function () { DemoFlow.showOverlay(DemoFlow.currentStep()); }, 500);
      }
    },
    showOverlay: function (stepIndex) {
      var step = DemoFlow.steps[stepIndex];
      if (!step) return;
      var ov = document.getElementById('demoOverlay');
      if (!ov) {
        ov = document.createElement('div');
        ov.id = 'demoOverlay';
        ov.className = 'demo-overlay';
        document.body.appendChild(ov);
      }
      var total = DemoFlow.steps.length;
      var isLast = stepIndex >= total - 1;
      ov.innerHTML =
        '<div class="demo-card" role="dialog" aria-label="Guided demo">' +
        '<div class="demo-head"><strong>▶ RUN DIGITAL TWIN DEMO</strong>' +
        '<span class="demo-progress">Step ' + (stepIndex + 1) + ' / ' + total + '</span></div>' +
        '<div class="demo-step-title">' + esc(step.title) + '</div>' +
        '<p class="demo-step-text">' + esc(step.text) + '</p>' +
        '<p class="demo-disclaimer">Demo for education only, not medical advice. All records are synthetic.</p>' +
        '<div class="demo-actions">' +
        '<button type="button" class="btn btn-ghost" id="demoStop">Exit demo</button>' +
        (isLast
          ? '<button type="button" class="btn btn-primary" id="demoFinish">Finish</button>'
          : '<button type="button" class="btn btn-primary" id="demoNext">Next step →</button>') +
        '</div></div>';
      var stop = document.getElementById('demoStop');
      if (stop) stop.addEventListener('click', function () { DemoFlow.stop(); toast('Demo stopped.', 'info'); });
      var nextBtn = document.getElementById('demoNext');
      if (nextBtn) nextBtn.addEventListener('click', function () { DemoFlow.run(stepIndex + 1); });
      var fin = document.getElementById('demoFinish');
      if (fin) fin.addEventListener('click', function () {
        DemoFlow.stop();
        toast('Demo complete. All steps used real local data.', 'success');
      });
    }
  };

  /* ============================================================== PWA */
  var deferredInstall = null;
  function initPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('service-worker.js').then(function () {
          Array.prototype.forEach.call(document.querySelectorAll('[data-install]'), function (b) { b.hidden = false; });
        }).catch(function () {
          /* SW unavailable (e.g. insecure context) - app still works */
        });
      });
    }
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredInstall = e;
      Array.prototype.forEach.call(document.querySelectorAll('[data-install]'), function (b) { b.hidden = false; });
    });
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-install]') : null;
      if (!b) return;
      e.preventDefault();
      if (deferredInstall) {
        deferredInstall.prompt();
        deferredInstall.userChoice.then(function () { deferredInstall = null; b.hidden = true; }).catch(function () { deferredInstall = null; });
      } else {
        toast('Use your browser menu → "Install app" / "Add to Home screen". Installation depends on browser and device.', 'info');
      }
    });
  }

  /* ====================================================== boot sequence */
  var readyPromise = null;
  function boot(pageName) {
    Storage.setSetting('currentPage', pageName);
    initTheme();
    lang = Storage.getSetting('language', 'en');
    if (!I18N[lang]) lang = 'en';
    applyI18n(document);
    initConnection();
    initPWA();

    var storeMode = '...';
    readyPromise = Storage.init().then(function (mode) {
      storeMode = mode;
      return DemoData.ensureSeeded();
    }).then(function (patients) {
      Storage.setSetting('storeMode', storeMode);
      document.dispatchEvent(new CustomEvent('vpdt:ready', { detail: { patients: patients, storeMode: storeMode } }));
      updateConnectionUI();
      return patients;
    }).catch(function (err) {
      console.error('init failed', err);
      toast('Could not initialise local demo storage. Some features may be limited.', 'error');
      document.dispatchEvent(new CustomEvent('vpdt:ready', { detail: { patients: [], storeMode: 'error' } }));
    });

    // delegated handlers for common controls
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('[data-action]') : null;
      if (!a) return;
      var action = a.getAttribute('data-action');
      if (action === 'theme') {
        e.preventDefault();
        if (a.id !== 'themeToggle') toggleTheme();
      }
      if (action === 'lang-en') { e.preventDefault(); setLanguage('en'); }
      if (action === 'lang-hi') { e.preventDefault(); setLanguage('hi'); }
      if (action === 'lang-mr') { e.preventDefault(); setLanguage('mr'); }
      if (action === 'logout') {
        e.preventDefault();
        Storage.clearSession();
        window.location.href = 'index.html';
      }
      if (action === 'run-demo') { e.preventDefault(); DemoFlow.start(); }
      if (action === 'reset-demo') { e.preventDefault(); resetDemoData(); }
      if (action === 'export') { e.preventDefault(); exportData(); }
      if (action === 'dismiss-notice') {
        e.preventDefault();
        Storage.setSetting('noticeAcknowledged', true);
        var n = document.getElementById('globalNotice');
        if (n) n.hidden = true;
      }
    });

    var ack = Storage.getSetting('noticeAcknowledged', false);
    var notice = document.getElementById('globalNotice');
    if (notice) notice.hidden = !!ack;

    var tgl = document.getElementById('themeToggle');
    if (tgl) tgl.addEventListener('click', toggleTheme);

    var lp = document.getElementById('langPick');
    if (lp) {
      lp.value = lang || 'en';
      lp.addEventListener('change', function (e) { setLanguage(e.target.value); });
    }

    return readyPromise;
  }

  function exportData() {
    Storage.exportAll().then(function (obj) {
      var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'vpdt-demo-export-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
      toast('Demo data exported as JSON (synthetic data only).', 'success');
    }).catch(function (e) { toast('Export failed: ' + e.message, 'error'); });
  }

  return {
    t: t, applyI18n: applyI18n, setLanguage: setLanguage, lang: function () { return lang; },
    setTheme: setTheme, toggleTheme: toggleTheme,
    esc: esc, $: $, $$: $$, setText: setText, html: html,
    fmtDate: fmtDate, fmtTime: fmtTime, greeting: greeting,
    medTimes: medTimes, medFrequency: medFrequency, medDateRange: medDateRange, medSchedule: medSchedule,
    toast: toast, modal: modal, confirm: confirmDialog,
    lineChart: lineChart, barChart: barChart, gauge: gauge,
    registerChartRedraw: registerChartRedraw, redrawCharts: redrawCharts,
    riskBadge: riskBadge, beep: beep,
    triggerDemoEvent: triggerDemoEvent, resetDemoData: resetDemoData,
    DemoFlow: DemoFlow,
    syncNow: syncNow, isOffline: offlineNow, setSimulatedOffline: setSimulatedOffline,
    updateConnectionUI: updateConnectionUI,
    ready: function () { return readyPromise; },
    boot: boot,
    exportData: exportData,
    storeMode: function () { return Storage.getSetting('storeMode', 'unknown'); }
  };
})();
