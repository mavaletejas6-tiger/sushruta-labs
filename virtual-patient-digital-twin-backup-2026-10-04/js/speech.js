/*
 * speech.js - Web Speech API helpers (voice input, read-aloud, wake phrase,
 *             and the SIMULATED emergency sequence).
 *
 * Everything degrades gracefully: if the browser has no Speech API the app
 * shows a clear message and keeps working with text input / buttons.
 * Emergency calls and SMS are ALWAYS simulated - no real call or message
 * is ever made by this demo.
 */
window.Speech = (function () {
  'use strict';

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var synth = window.speechSynthesis || null;
  var recog = null;
  var listening = false;
  var wakeActive = false;
  var wakePhrase = '';
  var wakeTimer = null;

  function supported() { return !!SR; }
  function ttsSupported() { return !!synth; }

  /* ---------------------------------------------------------- one-shot ASR */
  function listen(opts) {
    opts = opts || {};
    if (!SR) {
      if (opts.onError) opts.onError('unsupported');
      return null;
    }
    try {
      var r = new SR();
      r.lang = opts.lang || (App.lang() === 'hi' ? 'hi-IN' : App.lang() === 'mr' ? 'mr-IN' : 'en-IN');
      r.interimResults = opts.interim !== false;
      r.maxAlternatives = 3;
      r.continuous = false;
      r.onresult = function (ev) {
        var interim = '', final = '';
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          var res = ev.results[i];
          if (res.isFinal) final += res[0].transcript;
          else interim += res[0].transcript;
        }
        if (opts.onInterim && interim) opts.onInterim(interim);
        if (final && opts.onResult) opts.onResult(final.trim(), ev.results);
      };
      r.onerror = function (ev) {
        if (opts.onError) opts.onError(ev.error || 'error');
      };
      r.onend = function () {
        listening = false;
        if (opts.onEnd) opts.onEnd();
      };
      listening = true;
      r.start();
      recog = r;
      return r;
    } catch (e) {
      if (opts.onError) opts.onError('start-failed');
      return null;
    }
  }
  function stopListening() {
    try { if (recog) recog.stop(); } catch (e) { /* ignore */ }
    listening = false;
  }

  /* ------------------------------------------------------------- read aloud */
  function speak(text, opts) {
    opts = opts || {};
    if (!synth) {
      if (opts.onError) opts.onError('unsupported');
      return false;
    }
    try {
      synth.cancel();
      var u = new SpeechSynthesisUtterance(String(text).slice(0, 1200));
      u.lang = opts.lang || (App.lang() === 'hi' ? 'hi-IN' : App.lang() === 'mr' ? 'mr-IN' : 'en-IN');
      u.rate = opts.rate || 0.98;
      if (opts.onEnd) u.onend = opts.onEnd;
      synth.speak(u);
      return true;
    } catch (e) {
      return false;
    }
  }
  function stopSpeaking() { try { if (synth) synth.cancel(); } catch (e) {} }

  /* ---------------------------------------------------------- wake phrase */
  function startWakePhrase(phrase, handlers) {
    handlers = handlers || {};
    if (!SR) {
      if (handlers.onError) handlers.onError('unsupported');
      return false;
    }
    wakePhrase = (phrase || '').toLowerCase().trim();
    if (!wakePhrase) {
      if (handlers.onError) handlers.onError('no-phrase');
      return false;
    }
    wakeActive = true;
    pump();
    return true;

    function pump() {
      if (!wakeActive) return;
      var r = listen({
        lang: handlers.lang,
        interim: true,
        onInterim: function (txt) { if (handlers.onInterim) handlers.onInterim(txt); },
        onResult: function (txt) {
          var low = txt.toLowerCase();
          if (handlers.onPhrase && handlers.onPhrase(txt)) return;
          if (low.indexOf(wakePhrase) !== -1) {
            stopWakePhrase();
            if (handlers.onDetect) handlers.onDetect(txt);
          }
        },
        onError: function (err) {
          if (err === 'not-allowed' || err === 'service-not-allowed') {
            wakeActive = false;
            if (handlers.onError) handlers.onError(err);
          }
        },
        onEnd: function () {
          if (wakeActive) {
            clearTimeout(wakeTimer);
            wakeTimer = setTimeout(pump, 350);
          }
        }
      });
      if (!r) wakeActive = false;
    }
  }
  function stopWakePhrase() {
    wakeActive = false;
    clearTimeout(wakeTimer);
    stopListening();
  }
  function wakeListening() { return wakeActive; }

  /* ------------------------------------------------- SIMULATED emergency */
  function emergency(reason, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay emergency-overlay';
      overlay.innerHTML =
        '<div class="emergency-card" role="alertdialog" aria-label="Emergency countdown">' +
        '<h3>' + App.esc(App.t('emergencyTitle')) + '</h3>' +
        '<p><strong>' + App.esc(reason || 'Wake phrase detected') + '</strong></p>' +
        '<p>' + App.esc(App.t('callingIn')) + '</p>' +
        '<div class="countdown" id="emCount" aria-live="assertive">10</div>' +
        '<p class="fineprint" id="emListenStatus">Listening for CANCEL…</p>' +
        '<button type="button" class="btn btn-danger btn-lg" id="emCancel">CANCEL</button>' +
        '</div>';
      document.body.appendChild(overlay);
      App.beep('sos');

      var seconds = 10;
      var done = false;
      var rec = null;

      function cleanup() {
        clearInterval(iv);
        if (rec) { try { rec.stop(); } catch (e) {} }
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }
      async function fire() {
        if (done) return;
        done = true;
        cleanup();
        var pid = Storage.getSetting('currentPatientId', null);
        var p = opts.patient || null;
        if (!p && pid) { try { p = await Storage.getPatient(pid); } catch (e) { p = null; } }
        if (p) {
          await Storage.saveAlert({
            patientId: p.id, level: 'red',
            title: 'Emergency phrase detected (SIMULATED)',
            reason: reason + ' - demo wake phrase / SOS activation.',
            action: 'SIMULATED: demo SMS to emergency contact, SIMULATED call started, doctor dashboard alert created. No real call or SMS was made.',
            status: 'open', synthetic: true, simulated: true
          });
          await Storage.saveAuditLog({
            actorId: p.id, actorRole: 'patient', action: 'emergency.simulated',
            patientId: p.id,
            message: 'Simulated emergency triggered (' + reason + '). DEMO ONLY - no real services contacted.'
          });
          document.dispatchEvent(new CustomEvent('vpdt:data'));
        }
        App.modal({
          title: App.t('emergencyAlert'),
          body:
            App.t('emergencyAlert') + '\n\n' +
            'Demo SMS simulated\n' +
            App.t('callSimulated') + '\n\n' +
            'Alert created in the local doctor dashboard for ' + (p ? p.id : 'demo patient') + '.\n\n' +
            'Please contact a qualified healthcare professional or local emergency services for a real emergency.\n\n' +
            'SYNTHETIC DEMO DATA - no real emergency service was contacted.',
          actions: [{ label: 'OK', value: true, primary: true }]
        });
        App.beep('alarm');
        resolve({ triggered: true, cancelled: false });
      }
      function cancel() {
        if (done) return;
        done = true;
        cleanup();
        App.toast(App.t('emergencyCancelled'), 'info');
        resolve({ triggered: false, cancelled: true });
      }
      var iv = setInterval(function () {
        seconds--;
        var el = document.getElementById('emCount');
        if (el) el.textContent = String(Math.max(seconds, 0));
        if (seconds <= 0) fire();
      }, 1000);

      overlay.querySelector('#emCancel').addEventListener('click', cancel);

      if (SR) {
        try {
          rec = new SR();
          rec.lang = 'en-IN';
          rec.continuous = true;
          rec.interimResults = true;
          rec.onresult = function (ev) {
            for (var i = 0; i < ev.results.length; i++) {
              var txt = (ev.results[i][0].transcript || '').toLowerCase();
              if (txt.indexOf('cancel') !== -1) { cancel(); return; }
            }
          };
          rec.onerror = function () {
            var s = document.getElementById('emListenStatus');
            if (s) s.textContent = 'Voice cancel unavailable - use the CANCEL button.';
          };
          rec.onend = function () {
            var s = document.getElementById('emListenStatus');
            if (s && !done) s.textContent = 'Listening paused - use the CANCEL button.';
          };
          rec.start();
        } catch (e) {
          var s2 = document.getElementById('emListenStatus');
          if (s2) s2.textContent = 'Voice cancel unavailable - use the CANCEL button.';
        }
      } else {
        var s3 = document.getElementById('emListenStatus');
        if (s3) s3.textContent = 'Speech recognition not supported - use the CANCEL button.';
      }
    });
  }

  return {
    supported: supported,
    ttsSupported: ttsSupported,
    listen: listen,
    stopListening: stopListening,
    speak: speak,
    stopSpeaking: stopSpeaking,
    startWakePhrase: startWakePhrase,
    stopWakePhrase: stopWakePhrase,
    wakeListening: wakeListening,
    emergency: emergency
  };
})();
