/*
 * notifications.js - medicine reminders.
 *
 * Permission is requested ONLY when the user activates reminders
 * (never on page load).
 *
 * Fallback chain:
 *   1. Notification API (if granted)
 *   2. Audio alarm (bundled WAV + WebAudio beep)
 *   3. In-app SMS-style reminder card (always available)
 *
 * No real SMS is ever sent.
 */
window.Notify = (function () {
  'use strict';

  var enabled = false;
  var timer = null;
  var patientId = null;
  var lastFired = {};

  function permissionState() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission; // 'default' | 'granted' | 'denied'
  }

  /* called only from an explicit user action (toggle switch) */
  async function requestPermission() {
    if (!('Notification' in window)) {
      App.toast('Notifications are not supported in this browser. In-app reminders will be used instead.', 'info');
      return 'unsupported';
    }
    try {
      var res = await Notification.requestPermission();
      if (res === 'granted') App.toast('Notification permission granted.', 'success');
      else App.toast('Notification permission ' + res + '. In-app reminders will be used instead.', 'info');
      return res;
    } catch (e) {
      App.toast('Could not request notification permission. In-app reminders will be used instead.', 'info');
      return 'denied';
    }
  }

  function systemNotify(title, body) {
    var st = permissionState();
    if (st === 'granted') {
      try {
        var n = new Notification(title, { body: body, icon: 'assets/icons/icon-192.png', tag: 'vpdt-reminder' });
        setTimeout(function () { try { n.close(); } catch (e) {} }, 8000);
        return true;
      } catch (e) { /* fall through */ }
    }
    return false;
  }

  /* SMS-style in-app fallback card (SIMULATED - no real SMS) */
  function smsStyleCard(med) {
    var box = document.createElement('div');
    box.className = 'sms-card';
    box.setAttribute('role', 'alert');
    box.innerHTML =
      '<div class="sms-head">REMINDER <span class="tag tag-demo">SIMULATED</span></div>' +
      '<p>Your medicine is scheduled now.</p>' +
      '<dl>' +
      '<dt>Medicine:</dt><dd>' + App.esc(med.name) + ' ' + App.esc(med.dose || '') + '</dd>' +
      '<dt>Time:</dt><dd>' + App.esc(med.time) + '</dd>' +
      '</dl>' +
      '<div class="sms-actions">' +
      '<button type="button" class="btn btn-primary btn-sm" data-sms="taken">I took my medicine</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-sms="later">Remind me later</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-sms="close">Close</button>' +
      '</div>' +
      '<p class="fineprint">No real SMS was sent. This is an in-app demonstration reminder.</p>';
    var host = document.getElementById('reminderHost') || document.body;
    host.appendChild(box);
    App.beep('alarm');
    var offline = App.isOffline();
    var body = 'Medicine: ' + med.name + ' ' + (med.dose || '') + '\nTime: ' + med.time + (offline ? '\n(Offline - saved locally)' : '');
    var sys = systemNotify('Reminder: ' + med.name, body);
    if (!sys) {
      box.querySelector('.sms-head').insertAdjacentHTML('beforeend', ' <span class="tag">Notification API unavailable</span>');
    }
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-sms]');
      if (!b) return;
      var act = b.getAttribute('data-sms');
      if (act === 'close') box.remove();
      if (act === 'later') {
        box.remove();
        App.toast('Reminder snoozed for 10 minutes (demo).', 'info');
        setTimeout(function () { fireReminder(med, true); }, 10 * 60 * 1000);
      }
      if (act === 'taken') {
        box.remove();
        document.dispatchEvent(new CustomEvent('vpdt:quick-taken', { detail: med }));
      }
    });
    return box;
  }

  function fireReminder(med, isSnooze) {
    if (!enabled && !isSnooze) return;
    smsStyleCard(med);
    document.dispatchEvent(new CustomEvent('vpdt:reminder', { detail: med }));
  }

  function hhmmNow() {
    var d = new Date();
    return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  }

  /* check every 30 s which scheduled doses are due */
  function tick() {
    if (!patientId || !enabled) return;
    var now = hhmmNow();
    var p = Storage.getPatient ? null : null;
    Storage.getPatient(patientId).then(function (pat) {
      if (!pat || !pat.medicines) return;
      var due = [];
      pat.medicines.forEach(function (m) {
        (m.times || []).forEach(function (tm) {
          if (tm === 'as-needed') return;
          var key = m.id + '@' + tm;
          var diff = minutesDiff(tm, now);
          if (diff >= 0 && diff < 1 && !lastFired[key]) {
            lastFired[key] = Date.now();
            due.push({ id: m.id, name: m.name, dose: m.dose, time: tm });
          }
        });
      });
      due.forEach(function (d) { fireReminder(d); });
      // clear keys older than a day
      var dayAgo = Date.now() - 864e5;
      Object.keys(lastFired).forEach(function (k) { if (lastFired[k] < dayAgo) delete lastFired[k]; });
    }).catch(function () { /* ignore */ });
  }

  function minutesDiff(hhmmA, hhmmB) {
    var a = hhmmA.split(':'), b = hhmmB.split(':');
    var mins = (Number(a[0]) * 60 + Number(a[1])) - (Number(b[0]) * 60 + Number(b[1]));
    return mins;
  }

  async function enable(pid) {
    patientId = pid;
    enabled = true;
    Storage.setSetting('remindersEnabled', true);
    await requestPermission();
    if (timer) clearInterval(timer);
    timer = setInterval(tick, 30000);
    tick();
    App.toast('Reminders enabled. They run only while this page is open (demo).', 'success');
    document.dispatchEvent(new CustomEvent('vpdt:reminders'));
  }

  function disable() {
    enabled = false;
    patientId = null;
    Storage.setSetting('remindersEnabled', false);
    if (timer) clearInterval(timer);
    timer = null;
    App.toast('Reminders disabled.', 'info');
    document.dispatchEvent(new CustomEvent('vpdt:reminders'));
  }

  function isEnabled() { return enabled; }
  function isSupported() { return 'Notification' in window; }

  return {
    requestPermission: requestPermission,
    permissionState: permissionState,
    enable: enable,
    disable: disable,
    isEnabled: isEnabled,
    isSupported: isSupported,
    preview: function (med) { smsStyleCard(med); }
  };
})();
