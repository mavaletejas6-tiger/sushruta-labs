/*
 * assistant.js - offline-first rule-based assistant with an OPTIONAL
 *                 local Ollama connector.
 *
 * Behaviour:
 *   1. Try the local knowledge base (data/knowledge-base.json) - works offline.
 *   2. If Ollama is reachable at localhost, offer it as "Local AI: Connected"
 *      and answer through it; any network/CORS error falls back silently.
 *   3. Refuse diagnostic questions with safe guidance.
 *
 * The assistant never diagnoses and never requires Ollama.
 */
window.Assistant = (function () {
  'use strict';

  var OLLAMA_URLS = ['http://127.0.0.1:11434', 'http://localhost:11434'];
  var activeOllamaUrl = OLLAMA_URLS[0];
  var ollamaStatus = 'unknown';   // unknown | checking | connected | no_models | unavailable
  var ollamaModels = [];
  var chosenModel = null;
  var kb = null;
  var prefs = ['gemma', 'phi', 'llama', 'qwen', 'mistral', 'deepseek', 'tinyllama'];

  /* -------------------------------------------------------- knowledge base */
  async function ensureKB() {
    if (kb) return kb;
    kb = await DemoData.getKB();
    return kb;
  }

  function normalise(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9\s\u0900-\u097F]/g, ' ').trim(); }

  function matches(entry, words) {
    var hit = 0;
    var kws = (entry.keywords || []).map(function (k) { return String(k).toLowerCase(); });
    kws.forEach(function (k) {
      if (words.indexOf(k) !== -1) hit += 3;
      else {
        var parts = k.split(' ');
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i];
          if (p.length > 2 && words.indexOf(p) !== -1) { hit += 2; break; }
        }
        if (hit === 0 || true) {
          if (words.some(function (w) { return w.length > 3 && (k.indexOf(w) !== -1 || w.indexOf(k) !== -1); })) hit += 1;
        }
      }
    });
    if (entry.question) {
      var q = normalise(entry.question).split(' ');
      words.forEach(function (w) { if (w.length > 3 && q.indexOf(w) !== -1) hit += 1; });
    }
    return hit;
  }

  /* Friendly greeting & general conversation fallback */
  function greetingAnswer(q) {
    var greetings = ['hi', 'hello', 'hey', 'namaste', 'good morning', 'good evening', 'greetings', 'hlo'];
    var isGreeting = greetings.some(function (g) {
      return q === g || q.indexOf(g + ' ') === 0 || q.indexOf(' ' + g) !== -1;
    });
    if (isGreeting) {
      return {
        source: 'rule',
        text: 'Hello! I am RobotDoctor, your offline healthcare assistant. How can I help you today? You can ask me about HbA1c, sleep, blood pressure, SpO2, medicines, walking, stress, or how the digital twin works.',
        safe: true
      };
    }

    var identityQueries = ['who are you', 'what is your name', 'what are you', 'who created you', 'what can you do', 'help'];
    var isIdentity = identityQueries.some(function (iq) { return q.indexOf(iq) !== -1; });
    if (isIdentity) {
      return {
        source: 'rule',
        text: 'I am RobotDoctor, an offline-first assistant for the Virtual Patient Digital Twin demo. I can answer wellness questions, explain vitals (like BP, HbA1c, SpO2, sleep), explain medication adherence, and explain how the risk score works.',
        safe: true
      };
    }

    var thanksQueries = ['thanks', 'thank you', 'dhanyawad', 'shukriya'];
    var isThanks = thanksQueries.some(function (tq) { return q.indexOf(tq) !== -1; });
    if (isThanks) {
      return {
        source: 'rule',
        text: "You're very welcome! Stay healthy. Let me know if you have any other questions.",
        safe: true
      };
    }

    return null;
  }

  async function ruleAnswer(question) {
    var store = await ensureKB();
    var q = normalise(question);
    var words = q.split(/\s+/).filter(Boolean);

    // Check built-in conversational responses first
    var greet = greetingAnswer(q);
    if (greet) return greet;

    var triggers = (store.refusalTriggers || []).concat([]);
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i] && q.indexOf(String(triggers[i]).toLowerCase()) !== -1) {
        return { source: 'rule', text: store.refusalAnswer || 'I cannot prescribe medicines or change your dose. Please speak to a qualified healthcare professional.', safe: true };
      }
    }

    var best = null, bestScore = 0;
    (store.entries || []).forEach(function (e) {
      var s = matches(e, words);
      if (s > bestScore) { bestScore = s; best = e; }
    });
    if (best && bestScore >= 2) {
      var lang = (typeof App !== 'undefined' && App.lang ? App.lang() : 'en') || 'en';
      var text = (best.answer && (best.answer[lang] || best.answer.en)) || (best.answer && best.answer.en) || '';
      var suffix = '\n\n— General guidance, not a diagnosis. Emergency in India: 112 / 108; mental-health helpline Tele-MANAS 14416.';
      if (text.indexOf('112') === -1) text += suffix;
      return { source: 'rule', text: text, question: best.question, safe: false };
    }
    // Helpful fallback: list closest matches so every patient question gets an answer path
    var scored = (store.entries || []).map(function (e) { return { e: e, s: matches(e, words) }; })
      .sort(function (a, b) { return b.s - a.s; }).slice(0, 3);
    var names = scored.filter(function (x) { return x.e && x.e.question; }).map(function (x) { return '• ' + x.e.question; }).join('\n');
    return {
      source: 'rule',
      text: 'I can help with that. Try asking one of these, or type your exact question:\n' + names + '\n\nCommon topics: fever, chest pain, BP, cough, stomach, headache, sugar, periods, pregnancy, child health, skin, sleep, urine, emergency (112/108).',
      safe: true
    };
  }

  /* -------------------------------------------------------------- Ollama */
  async function tryFetchTags(baseUrl) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 5000);
    try {
      var res = await fetch(baseUrl + '/api/tags', ctrl ? { signal: ctrl.signal } : {});
      clearTimeout(timer);
      if (res.ok) {
        var data = await res.json();
        return data;
      }
    } catch (e) {
      clearTimeout(timer);
    }
    return null;
  }

  async function detectOllama() {
    ollamaStatus = 'checking';
    paintStatus();

    var data = null;
    for (var u = 0; u < OLLAMA_URLS.length; u++) {
      data = await tryFetchTags(OLLAMA_URLS[u]);
      if (data) {
        activeOllamaUrl = OLLAMA_URLS[u];
        break;
      }
    }

    if (data) {
      ollamaModels = (data.models || []).map(function (m) { return m.name; });
      chosenModel = null;
      for (var i = 0; i < prefs.length && !chosenModel; i++) {
        chosenModel = ollamaModels.find(function (n) { return n.toLowerCase().indexOf(prefs[i]) !== -1; }) || null;
      }
      chosenModel = chosenModel || ollamaModels[0] || null;
      if (chosenModel) {
        ollamaStatus = 'connected';
      } else {
        ollamaStatus = 'no_models';
      }
    } else {
      ollamaStatus = 'unavailable';
    }
    paintStatus();
    return { status: ollamaStatus, models: ollamaModels, model: chosenModel };
  }

  function paintStatus() {
    var els = document.querySelectorAll('.local-ai-status, #localAIStatus');
    els.forEach(function (el) {
      if (!el) return;
      if (ollamaStatus === 'connected') {
        el.className = 'conn-badge conn-online local-ai-status';
        el.textContent = '🟢 Local AI: Connected (' + chosenModel + ')';
      } else if (ollamaStatus === 'checking') {
        el.className = 'conn-badge local-ai-status';
        el.textContent = '🟡 Local AI: Checking…';
      } else if (ollamaStatus === 'no_models') {
        el.className = 'conn-badge local-ai-status';
        el.textContent = '🟡 Local AI: Server running (No models installed)';
      } else if (ollamaStatus === 'unavailable') {
        el.className = 'conn-badge conn-offline local-ai-status';
        el.textContent = '🔵 Local AI: Offline KB Active';
      } else {
        el.className = 'conn-badge local-ai-status';
        el.textContent = '🔵 Local AI: Not checked';
      }
    });
  }

  async function askOllama(question) {
    if (ollamaStatus !== 'connected' || !chosenModel) throw new Error('Ollama not connected');
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 120000);
    try {
      var res = await fetch(activeOllamaUrl + '/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: chosenModel,
          stream: false,
          prompt: 'You are RobotDoctor, a helpful medical wellness assistant inside an offline digital twin prototype. You provide concise, friendly, clear wellness information. You NEVER diagnose, prescribe, or give emergency instructions. If asked for a diagnosis, advise seeing a doctor.\n\nUser Question: ' + question
        }),
        signal: ctrl ? ctrl.signal : undefined
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error('status ' + res.status);
      var data = await res.json();
      if (!data.response) throw new Error('empty response');
      return String(data.response).trim();
    } catch (e) {
      clearTimeout(timer);
      console.warn('askOllama error:', e.message || e);
      throw e;
    }
  }

  /* ----------------------------------------------------------- main entry */
  async function answer(question, opts) {
    opts = opts || {};
    var q = String(question || '').trim();
    if (!q) return { source: 'rule', text: 'Please type a question.' };

    // Always re-check Ollama if not already connected
    if (ollamaStatus !== 'connected') {
      await detectOllama();
    }

    // Diagnostic safety net first
    var pre = await ruleAnswer(q);
    if (pre.safe && pre.source === 'rule' && (pre.text.indexOf('cannot diagnose') !== -1)) return pre;

    if (opts.useLocalAI !== false && ollamaStatus === 'connected' && chosenModel) {
      try {
        var txt = await askOllama(q);
        return { source: 'ollama', model: chosenModel, text: txt };
      } catch (e) {
        console.warn('Ollama generation failed, falling back to rule engine:', e);
      }
    }
    return ruleAnswer(q);
  }

  /* --------------------------------------------------------- chat binding */
  function bindChat(opts) {
    opts = opts || {};
    var form = opts.form;
    var input = opts.input;
    var log = opts.log;
    if (!form || !input || !log) return;

    function addBubble(who, text, meta) {
      var b = document.createElement('div');
      b.className = 'chat-bubble chat-' + who;
      var head = document.createElement('div');
      head.className = 'chat-who';
      head.textContent = who === 'user' ? 'You' : 'RobotDoctor' + (meta ? ' (' + meta + ')' : '');
      var body = document.createElement('div');
      body.className = 'chat-text';
      body.textContent = text;
      b.appendChild(head); b.appendChild(body);
      if (who !== 'user' && opts.speakButton) {
        var s = document.createElement('button');
        s.type = 'button';
        s.className = 'btn btn-ghost btn-sm chat-speak';
        s.textContent = '🔊 ' + (App.lang() === 'hi' ? 'पढ़ें' : App.lang() === 'mr' ? 'वाचा' : 'Read aloud');
        s.addEventListener('click', function () { Speech.speak(text); });
        b.appendChild(s);
      }
      log.appendChild(b);
      log.scrollTop = log.scrollHeight;
      return b;
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (!q) return;
      input.value = '';
      addBubble('user', q);
      var thinking = addBubble('bot', 'Thinking…');
      try {
        var res = await answer(q, { useLocalAI: opts.useLocalAI !== false });
        thinking.remove();
        var metaStr = res.source === 'ollama' ? ('Local Model: ' + res.model) : 'Offline KB';
        addBubble('bot', res.text, metaStr);
        if (opts.speakAnswers && typeof Speech !== 'undefined') Speech.speak(res.text);
      } catch (err) {
        thinking.remove();
        addBubble('bot', 'Something went wrong with the assistant, but the app keeps working. Please try again.');
      }
    });

    if (opts.voiceButton) {
      opts.voiceButton.addEventListener('click', function () {
        if (typeof Speech === 'undefined' || !Speech.supported()) {
          App.toast(App.t('voiceUnsupported'), 'info');
          input.focus();
          return;
        }
        opts.voiceButton.disabled = true;
        App.toast('Listening… speak now', 'info');
        Speech.listen({
          onResult: function (txt) { input.value = txt; form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); },
          onError: function () { App.toast(App.t('voiceUnsupported'), 'info'); },
          onEnd: function () { opts.voiceButton.disabled = false; }
        });
      });
    }
    return { addBubble: addBubble };
  }

  return {
    answer: answer,
    ruleAnswer: ruleAnswer,
    detectOllama: detectOllama,
    askOllama: askOllama,
    bindChat: bindChat,
    paintStatus: paintStatus,
    status: function () { return ollamaStatus; },
    models: function () { return ollamaModels; },
    ensureKB: ensureKB
  };
})();
