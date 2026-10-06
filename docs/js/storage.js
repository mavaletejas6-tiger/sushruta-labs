/*
 * storage.js - single storage abstraction for the Virtual Patient Digital Twin demo.
 *
 * Primary store  : IndexedDB (structured patient records, vitals, logs, alerts, audit)
 * Secondary store: localStorage (theme, language, session, UI settings, wake phrase, consent flags)
 *
 * No other module may talk to localStorage/IndexedDB directly - always go through Storage.
 *
 * SECURITY NOTE FOR REAL DEPLOYMENTS:
 * A production healthcare system requires a secure backend, encryption at rest and in transit,
 * professional identity management, access control, regulatory compliance, professional
 * security testing and secure cloud/on-premise infrastructure. This demo stores synthetic
 * data locally in the browser only and claims no HIPAA / GDPR / DPDP compliance.
 */
window.Storage = (function () {
  'use strict';

  var DB_NAME = 'vpdt-demo';
  var DB_VERSION = 1;
  var STORES = ['patients', 'vitals', 'medlogs', 'alerts', 'audit', 'sync', 'certs', 'advice', 'consults'];
  var LS_PREFIX = 'vpdt:';
  var LS_FALLBACK_PREFIX = 'vpdt:store:';
  var db = null;
  var idbAvailable = true;

  /* ---------------------------------------------------------------- utils */
  function lsGet(key, fallback) {
    try {
      var raw = window.localStorage.getItem(LS_PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function lsSet(key, value) {
    try {
      window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }
  function lsRemove(key) {
    try { window.localStorage.removeItem(LS_PREFIX + key); } catch (e) { /* ignore */ }
  }
  function uid(prefix) {
    return (prefix || 'ID') + '-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1e6).toString(36).toUpperCase();
  }
  function deepClone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }

  /* localStorage fallback "store" used when IndexedDB is unavailable/broken */
  function fbStore(name) {
    var all = lsGet(LS_FALLBACK_PREFIX + name, {}) || {};
    if (typeof all !== 'object' || all === null) all = {};
    return all;
  }
  function fbPut(name, id, value) {
    var all = fbStore(name);
    all[id] = value;
    lsSet(LS_FALLBACK_PREFIX + name, all);
  }
  function fbGet(name, id) {
    var all = fbStore(name);
    return all[id] !== undefined ? all[id] : null;
  }
  function fbAll(name) {
    var all = fbStore(name);
    return Object.keys(all).map(function (k) { return all[k]; });
  }
  function fbDelete(name, id) {
    var all = fbStore(name);
    delete all[id];
    lsSet(LS_FALLBACK_PREFIX + name, all);
  }
  function fbClear(name) { lsSet(LS_FALLBACK_PREFIX + name, {}); }

  /* ------------------------------------------------------------- IndexedDB */
  function openDb() {
    return new Promise(function (resolve) {
      if (!('indexedDB' in window)) {
        idbAvailable = false;
        return resolve(null);
      }
      var req;
      try {
        req = window.indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        idbAvailable = false;
        return resolve(null);
      }
      req.onupgradeneeded = function (ev) {
        var d = ev.target.result;
        STORES.forEach(function (s) {
          if (!d.objectStoreNames.contains(s)) {
            var os = d.createObjectStore(s, { keyPath: 'id' });
            if (s === 'patients') os.createIndex('status', 'status', { unique: false });
          }
        });
      };
      req.onsuccess = function () { db = req.result; resolve(db); };
      req.onerror = function () { idbAvailable = false; db = null; resolve(null); };
      req.onblocked = function () { idbAvailable = false; resolve(null); };
      setTimeout(function () { if (!db) { idbAvailable = false; resolve(null); } }, 2500);
    });
  }

  function tx(store, mode) {
    if (!db) throw new Error('idb-unavailable');
    return db.transaction(store, mode).objectStore(store);
  }
  function reqToPromise(r) {
    return new Promise(function (res, rej) {
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }

  async function put(store, value) {
    if (!value.id) value.id = uid(store.toUpperCase());
    if (idbAvailable && db) {
      try {
        await reqToPromise(tx(store, 'readwrite').put(value));
        return value;
      } catch (e) { /* fall through to localStorage */ }
    }
    fbPut(store, value.id, value);
    return value;
  }
  async function get(store, id) {
    var v = null;
    if (idbAvailable && db) {
      try {
        v = (await reqToPromise(tx(store, 'readonly').get(id))) || null;
      } catch (e) { v = null; }
    }
    if (v) return v;
    return fbGet(store, id);
  }
  async function all(store) {
    var fromIdb = [];
    if (idbAvailable && db) {
      try {
        fromIdb = (await reqToPromise(tx(store, 'readonly').getAll())) || [];
      } catch (e) { fromIdb = []; }
    }
    // merge with any entries written to the localStorage fallback
    var merged = {};
    fromIdb.forEach(function (v) { if (v && v.id) merged[v.id] = v; });
    fbAll(store).forEach(function (v) { if (v && v.id && !merged[v.id]) merged[v.id] = v; });
    return Object.keys(merged).map(function (k) { return merged[k]; });
  }
  async function del(store, id) {
    if (idbAvailable && db) {
      try { await reqToPromise(tx(store, 'readwrite').delete(id)); } catch (e) { /* fallback */ }
    }
    fbDelete(store, id);
    return true;
  }
  async function clearStore(store) {
    if (idbAvailable && db) {
      try { await reqToPromise(tx(store, 'readwrite').clear()); } catch (e) { /* fallback */ }
    }
    fbClear(store);
  }

  /* ------------------------------------------------------------ public API */
  var Storage = {
    available: function () { return idbAvailable && !!db; },
    uid: uid,
    clone: deepClone,

    init: async function () {
      await openDb();
      return Storage.available() ? 'IndexedDB' : 'localStorage fallback';
    },

    /* ----- patients ----- */
    savePatient: async function (patient) {
      if (!patient || !patient.id) throw new Error('Patient id required');
      patient.updatedAt = new Date().toISOString();
      return put('patients', patient);
    },
    getPatient: async function (id) { return get('patients', id); },
    getAllPatients: async function () {
      var list = await all('patients');
      list.sort(function (a, b) { return (a.id || '').localeCompare(b.id || ''); });
      return list;
    },
    updatePatient: async function (id, patch) {
      var p = await get('patients', id);
      if (!p) throw new Error('Patient not found: ' + id);
      Object.keys(patch || {}).forEach(function (k) { p[k] = patch[k]; });
      return Storage.savePatient(p);
    },
    deletePatient: async function (id) { return del('patients', id); },
    archivePatient: async function (id) {
      return Storage.updatePatient(id, { status: 'archived', archivedAt: new Date().toISOString() });
    },

    /* ----- vitals / wearable ----- */
    saveVital: async function (vital) {
      if (!vital.patientId) throw new Error('vital.patientId required');
      vital.id = vital.id || uid('VIT');
      vital.timestamp = vital.timestamp || new Date().toISOString();
      await put('vitals', vital);
      // simulated sync queue - frontend-only demo, nothing is uploaded anywhere real
      Storage.enqueueSync({ kind: 'vital', refId: vital.id, patientId: vital.patientId, label: 'Vital reading' });
      return vital;
    },
    getVitals: async function (patientId) {
      var list = await all('vitals');
      return list.filter(function (v) { return v.patientId === patientId; })
        .sort(function (a, b) { return (a.timestamp || '').localeCompare(b.timestamp || ''); });
    },

    /* ----- medication log ----- */
    saveMedicationLog: async function (log) {
      if (!log.patientId || !log.medicineId) throw new Error('log.patientId and log.medicineId required');
      log.id = log.id || uid('MEDLOG');
      log.actualTime = log.actualTime || new Date().toISOString();
      log.status = log.status || 'uncertain';
      log.source = log.source || 'manual';
      if (typeof log.confidence !== 'number') log.confidence = log.source === 'manual' ? 1 : 0.5;
      await put('medlogs', log);
      Storage.enqueueSync({ kind: 'medlog', refId: log.id, patientId: log.patientId, label: 'Medicine log: ' + (log.medicineName || log.medicineId) });
      await Storage.recomputeAdherence(log.patientId);
      return log;
    },
    getMedicationLogs: async function (patientId) {
      var list = await all('medlogs');
      return list.filter(function (l) { return l.patientId === patientId; });
    },
    recomputeAdherence: async function (patientId) {
      var logs = await Storage.getMedicationLogs(patientId);
      var cutoff = Date.now() - 7 * 864e5;
      var recent = logs.filter(function (l) { return new Date(l.actualTime).getTime() >= cutoff; });
      var p = await get('patients', patientId);
      if (!p) return null;
      var due = recent.filter(function (l) { return l.status !== 'skipped'; });
      var taken = due.filter(function (l) { return l.status === 'taken'; });
      if (due.length >= 3) {
        p.adherence = p.adherence || {};
        p.adherence.percent = Math.round((taken.length / due.length) * 100);
        p.adherence.last7 = due.slice(-7).map(function (l) { return l.status; });
        await Storage.savePatient(p);
      }
      return p ? p.adherence : null;
    },

    /* ----- alerts ----- */
    saveAlert: async function (alert) {
      alert.id = alert.id || uid('ALR');
      alert.timestamp = alert.timestamp || new Date().toISOString();
      alert.synthetic = alert.synthetic !== false;
      await put('alerts', alert);
      Storage.enqueueSync({ kind: 'alert', refId: alert.id, patientId: alert.patientId, label: 'Alert: ' + (alert.title || '') });
      return alert;
    },
    getAlerts: async function (patientId) {
      var list = await all('alerts');
      var f = list.filter(function (a) { return !patientId || a.patientId === patientId; });
      f.sort(function (a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); });
      return f;
    },

    /* ----- audit log ----- */
    saveAuditLog: async function (entry) {
      entry.id = entry.id || uid('AUD');
      entry.timestamp = entry.timestamp || new Date().toISOString();
      entry.actorId = entry.actorId || 'system';
      entry.actorRole = entry.actorRole || 'system';
      entry.action = entry.action || 'unknown';
      entry.message = entry.message || '';
      await put('audit', entry);
      return entry;
    },
    getAuditLog: async function () {
      var list = await all('audit');
      list.sort(function (a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); });
      return list;
    },

    /* ----- advice ----- */
    saveAdvice: async function (advice) {
      advice.id = advice.id || uid('ADV');
      advice.timestamp = advice.timestamp || new Date().toISOString();
      advice.status = advice.status || 'sent';
      await put('advice', advice);
      Storage.enqueueSync({ kind: 'advice', refId: advice.id, patientId: advice.patientId, label: 'Advice from ' + (advice.doctorName || 'doctor') });
      return advice;
    },
    getAdvice: async function (patientId) {
      var list = await all('advice');
      var f = list.filter(function (a) { return !patientId || a.patientId === patientId; });
      f.sort(function (a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); });
      return f;
    },

    /* ----- certificates ----- */
    saveCertificate: async function (cert) {
      cert.id = cert.id || uid('CERT');
      cert.createdAt = cert.createdAt || new Date().toISOString();
      await put('certs', cert);
      Storage.enqueueSync({ kind: 'certificate', refId: cert.id, patientId: cert.patientId, label: 'Certificate ' + cert.id });
      return cert;
    },
    getCertificate: async function (id) { return get('certs', id); },
    getCertificates: async function () { return all('certs'); },

    /* ----- teleconsultation (mock) ----- */
    saveConsult: async function (c) {
      c.id = c.id || uid('CON');
      c.createdAt = c.createdAt || new Date().toISOString();
      await put('consults', c);
      return c;
    },
    getConsults: async function () { return all('consults'); },

    /* ----- simulated sync queue ----- */
    enqueueSync: function (item) {
      if (Storage.isOffline()) {
        item.pending = true;
        item.queuedAt = new Date().toISOString();
        item.id = item.id || uid('SYNC');
        put('sync', item);
      } else {
        // online: record it as already flushed (demo "instant sync")
        item.pending = false;
        item.queuedAt = new Date().toISOString();
        item.syncedAt = new Date().toISOString();
        item.id = item.id || uid('SYNC');
        put('sync', item);
      }
    },
    getPendingSyncItems: async function () {
      var list = await all('sync');
      return list.filter(function (i) { return i.pending === true; });
    },
    getAllSyncItems: async function () { return all('sync'); },
    markSynced: async function (ids) {
      var list = await all('sync');
      var set = {};
      (ids || []).forEach(function (i) { set[i] = true; });
      for (var i = 0; i < list.length; i++) {
        var it = list[i];
        if (!it.pending) continue;
        if (ids && !set[it.id]) continue;
        it.pending = false;
        it.syncedAt = new Date().toISOString();
        await put('sync', it);
      }
      return true;
    },
    isOffline: function () { return (typeof navigator !== 'undefined' && navigator.onLine === false) || window.__vpdtOffline === true; },

    /* ----- settings (localStorage only) ----- */
    getSetting: function (k, d) { return lsGet(k, d); },
    setSetting: function (k, v) { return lsSet(k, v); },
    removeSetting: function (k) { return lsRemove(k); },
    clearLocalStore: function (name) { return clearStore(name); },

    getSession: function () { return lsGet('session', null); },
    setSession: function (s) { return lsSet('session', s); },
    clearSession: function () { lsRemove('session'); },

    /* ----- export / import / reset ----- */
    exportAll: async function () {
      var out = { app: 'virtual-patient-digital-twin', exportedAt: new Date().toISOString(), synthetic: true, stores: {} };
      for (var i = 0; i < STORES.length; i++) {
        out.stores[STORES[i]] = await all(STORES[i]);
      }
      out.settings = {
        theme: lsGet('theme', null),
        language: lsGet('language', 'en'),
        wakePhrase: lsGet('wakePhrase', null),
        consentFlags: lsGet('consentFlags', null)
      };
      return out;
    },
    importAll: async function (obj) {
      if (!obj || !obj.stores) throw new Error('Invalid import file');
      for (var i = 0; i < STORES.length; i++) {
        var name = STORES[i];
        var items = obj.stores[name] || [];
        await clearStore(name);
        for (var j = 0; j < items.length; j++) await put(name, items[j]);
      }
      if (obj.settings) {
        if (obj.settings.theme !== undefined && obj.settings.theme !== null) lsSet('theme', obj.settings.theme);
        if (obj.settings.language) lsSet('language', obj.settings.language);
        if (obj.settings.wakePhrase) lsSet('wakePhrase', obj.settings.wakePhrase);
        if (obj.settings.consentFlags) lsSet('consentFlags', obj.settings.consentFlags);
      }
      return true;
    },
    clearAllLocalData: async function () {
      for (var i = 0; i < STORES.length; i++) await clearStore(STORES[i]);
      var keys = [];
      try {
        for (var k = 0; k < window.localStorage.length; k++) {
          var key = window.localStorage.key(k);
          if (key && key.indexOf(LS_PREFIX) === 0) keys.push(key);
        }
        keys.forEach(function (key) { window.localStorage.removeItem(key); });
      } catch (e) { /* ignore */ }
      return true;
    },
    _stores: STORES
  };

  return Storage;
})();
