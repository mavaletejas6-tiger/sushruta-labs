const fs = require('fs');
const path = require('path');
const base = 'c:/Users/NISHA/OneDrive/shushruta  labs/virtual-patient-digital-twin';
const kb = JSON.parse(fs.readFileSync(path.join(base, 'data/knowledge-base.json'), 'utf8'));
function normalise(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim(); }
function matches(entry, words) {
  let hit = 0;
  const kws = (entry.keywords || []).map(k => String(k).toLowerCase());
  kws.forEach(k => {
    if (words.includes(k)) hit += 3;
    else {
      const parts = k.split(' ');
      for (const p of parts) { if (p.length > 2 && words.includes(p)) { hit += 2; break; } }
      if (words.some(w => w.length > 3 && (k.includes(w) || w.includes(k)))) hit += 1;
    }
  });
  if (entry.question) {
    const q = normalise(entry.question).split(' ');
    words.forEach(w => { if (w.length > 3 && q.includes(w)) hit += 1; });
  }
  return hit;
}
const tests = [
  'I have a fever. When should I worry?',
  'My baby under 3 months has a fever. What should I do?',
  'I have fever, severe body ache, and rash. Is it dengue?',
  'How long should I wait before getting tested for malaria or typhoid?',
  'I have burning urination. What should I do?',
  'I have chest pain. Is it my heart?',
  'My BP reading is high. What should I do right now?',
  'My cough has lasted more than 2 weeks. What should I do?',
  "I'm coughing up blood. Is it an emergency?",
  'I have loose motions. When do I need a doctor?',
  'My face is drooping and my speech is slurred. What do I do?',
  'My sugar is above 300. What should I do?',
  "My sugar is low and I'm shaky. What should I take?",
  'My back pain comes with leg weakness. Is it an emergency?',
  'My periods are very heavy. When is it an emergency?',
  "I'm pregnant and bleeding. What should I do?",
  'My baby is moving less in pregnancy. Is it dangerous?',
  'My child swallowed a coin or battery. What do I do?',
  'How much paracetamol can I safely give my child?',
  "I'm having thoughts of harming myself. Where do I get help?",
  'I have severe flank pain. Is it a kidney stone?',
  'I took too much medicine by mistake. What should I do?',
  'Someone collapsed and is unresponsive. What do I do?',
  'My vision is getting blurry. Do I need glasses or is it diabetes?',
  'What health checkups should I do each year?',
  'How do I quit smoking or tobacco?',
  'What is HbA1c?',
  'Why is sleep important?'
];
let pass = 0, fail = [];
for (const q of tests) {
  const words = normalise(q).split(/\s+/).filter(Boolean);
  let best = null, bestScore = 0;
  kb.entries.forEach(e => { const s = matches(e, words); if (s > bestScore) { bestScore = s; best = e; } });
  if (best && bestScore >= 2) pass++;
  else fail.push(q + ' (score ' + bestScore + ')');
}
console.log('KB_TOTAL=' + kb.entries.length + ' PASS=' + pass + '/' + tests.length);
if (fail.length) { console.log('FAIL:'); fail.forEach(f => console.log(' - ' + f)); process.exitCode = 1; }
// check assistant.js has no diagnosis-blocking triggers left
const asst = fs.readFileSync(path.join(base, 'js/assistant.js'), 'utf8');
const bad = ['chest pain', 'do i have', 'am i sick'].filter(t => asst.includes("'" + t + "'"));
console.log('BLOCKING_TRIGGERS_LEFT=' + JSON.stringify(bad));
