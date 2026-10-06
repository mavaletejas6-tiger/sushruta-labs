/*
 * auth.js - demo authentication: staff PIN, WebAuthn/passkey (when the
 *           browser actually supports it) and role-based sessions.
 *
 * HONESTY RULES (see spec §71):
 *  - "Biometric verified"/"Passkey verified" is only shown after a real,
 *    successful navigator.credentials assertion.
 *  - If WebAuthn is unavailable we say so and use the PIN fallback.
 *  - Demo accounts are synthetic; PINs are demo-only secrets.
 */
window.Auth = (function () {
  'use strict';

  var LS_CREDS = 'vpdt:passkeyCred';

  function supportsWebAuthn() {
    return !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create);
  }

  async function platformAuthenticatorAvailable() {
    if (!supportsWebAuthn()) return false;
    try {
      if (!PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (e) { return false; }
  }

  function b64url(buf) {
    var bytes = new Uint8Array(buf);
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64url(str) {
    var s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  function randomBuf(n) {
    var b = new Uint8Array(n);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(b);
    else for (var i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256);
    return b;
  }

  /* ---------------------------------------------------------- passkeys */
  async function registerPasskey(label) {
    if (!supportsWebAuthn()) throw new Error('WebAuthn is not supported in this browser');
    var challenge = randomBuf(32);
    var userId = randomBuf(16);
    var cred = await navigator.credentials.create({
      publicKey: {
        challenge: challenge,
        rp: { name: 'Virtual Patient Digital Twin (demo)', id: window.location.hostname },
        user: { id: userId, name: label, displayName: label },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }, { type: 'public-key', alg: -258 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60000,
        attestation: 'none'
      }
    });
    if (!cred) throw new Error('Passkey creation returned no credential');
    Storage.setSetting(LS_CREDS, { id: b64url(cred.rawId), label: label, createdAt: new Date().toISOString() });
    return true;
  }

  async function loginWithPasskey() {
    if (!supportsWebAuthn()) throw new Error('WebAuthn is not supported in this browser');
    var stored = Storage.getSetting(LS_CREDS, null);
    var publicKey = {
      challenge: randomBuf(32),
      timeout: 60000,
      userVerification: 'required'
    };
    if (stored && stored.id) {
      publicKey.allowCredentials = [{ type: 'public-key', id: fromB64url(stored.id) }];
    }
    var assertion = await navigator.credentials.get({ publicKey: publicKey });
    if (!assertion) throw new Error('No assertion returned');
    return { verified: true, credentialId: b64url(assertion.rawId) };
  }

  function hasPasskey() { return !!Storage.getSetting(LS_CREDS, null); }

  /* -------------------------------------------------------------- staff */
  async function staffList() { return DemoData.getStaff(); }

  async function loginStaff(id, pin) {
    var staff = await staffList();
    var found = null;
    for (var i = 0; i < staff.length; i++) {
      if (staff[i].id.toUpperCase() === String(id || '').toUpperCase().trim()) { found = staff[i]; break; }
    }
    if (!found) return { ok: false, message: 'Unknown demo staff ID. Try DOC-1001 or NUR-1001.' };
    if (String(found.pin) !== String(pin)) return { ok: false, message: 'Incorrect PIN for demo account ' + found.id + '.' };
    createSession({ role: found.role, id: found.id, name: found.name, method: 'pin' });
    await Storage.saveAuditLog({
      actorId: found.id, actorRole: found.role, action: 'auth.login',
      patientId: null, message: found.name + ' signed in with demo PIN.'
    });
    return { ok: true, staff: found };
  }

  /* ----------------------------------------------------------- patients */
  async function loginPatient(patientId) {
    var pid = String(patientId || '').trim().toUpperCase();
    if (!/^PT-\d{3,6}$/.test(pid)) return { ok: false, message: 'Enter a demo patient ID such as PT-1001.' };
    var p = await Storage.getPatient(pid);
    if (!p) return { ok: false, message: 'No demo patient found with ID ' + pid + '. Use Demo Mode to see the list.' };
    createSession({ role: 'patient', id: p.id, name: p.name, method: 'demo' });
    Storage.setSetting('currentPatientId', p.id);
    await Storage.saveAuditLog({
      actorId: p.id, actorRole: 'patient', action: 'auth.login',
      patientId: p.id, message: p.name + ' opened the patient dashboard (demo mode, no password).'
    });
    return { ok: true, patient: p };
  }

  /* ----------------------------------------------------------- sessions */
  function createSession(info) {
    var s = Object.assign({ createdAt: Date.now(), lastActivity: Date.now() }, info);
    Storage.setSession(s);
    return s;
  }
  function current() {
    var s = Storage.getSession();
    if (!s) return null;
    var ttl = 12 * 3600 * 1000;
    if (Date.now() - (s.createdAt || 0) > ttl) { Storage.clearSession(); return null; }
    s.lastActivity = Date.now();
    Storage.setSession(s);
    return s;
  }
  function touch() {
    var s = Storage.getSession();
    if (s) { s.lastActivity = Date.now(); Storage.setSession(s); }
  }
  function logout(msg) {
    Storage.clearSession();
    if (msg) App.toast(msg, 'info');
    window.location.href = 'index.html';
  }

  /**
   * Role guard. If the active session does not match, redirect.
   * lockAction is invoked when auto-lock fires.
   */
  function requireRole(role, opts) {
    opts = opts || {};
    var s = current();
    if (!s || (role && s.role !== role)) {
      if (opts.redirect !== false) window.location.href = opts.to || 'index.html';
      return null;
    }
    if (role === 'doctor' || role === 'nurse') startIdleWatch(opts);
    return s;
  }

  /* --------------------------------------------------------- auto-lock */
  var idleTimer = null;
  var lockMinutes = 5;
  var lockCb = null;
  function setLockMinutes(m) {
    lockMinutes = Math.max(1, Math.min(60, Number(m) || 5));
    Storage.setSetting('autoLockMinutes', lockMinutes);
  }
  function getLockMinutes() {
    return Number(Storage.getSetting('autoLockMinutes', 5)) || 5;
  }
  function startIdleWatch(opts) {
    lockCb = opts && opts.onLock;
    lockMinutes = getLockMinutes();
    ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(function (ev) {
      window.removeEventListener(ev, resetIdle);
      window.addEventListener(ev, resetIdle, { passive: true });
    });
    resetIdle();
  }
  function resetIdle() {
    clearTimeout(idleTimer);
    if (!lockCb) return;
    idleTimer = setTimeout(function () { doLock(true); }, lockMinutes * 60 * 1000);
  }
  function doLock(auto) {
    clearTimeout(idleTimer);
    var cb = lockCb;
    if (cb) cb(auto);
  }
  function lockNow() { doLock(false); }
  function stopIdleWatch() {
    clearTimeout(idleTimer);
    lockCb = null;
  }

  return {
    supportsWebAuthn: supportsWebAuthn,
    platformAuthenticatorAvailable: platformAuthenticatorAvailable,
    registerPasskey: registerPasskey,
    loginWithPasskey: loginWithPasskey,
    hasPasskey: hasPasskey,
    staffList: staffList,
    loginStaff: loginStaff,
    loginPatient: loginPatient,
    createSession: createSession,
    current: current,
    touch: touch,
    logout: logout,
    requireRole: requireRole,
    setLockMinutes: setLockMinutes,
    getLockMinutes: getLockMinutes,
    startIdleWatch: startIdleWatch,
    lockNow: lockNow,
    stopIdleWatch: stopIdleWatch,
    resetIdle: resetIdle
  };
})();
