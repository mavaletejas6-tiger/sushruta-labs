const fs = require('fs');
const path = require('path');
const base = 'c:/Users/NISHA/OneDrive/shushruta  labs/virtual-patient-digital-twin';
const kbPath = path.join(base, 'data/knowledge-base.json');
const partsDir = path.join(base, 'data/kb_parts');
const kb = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
const files = fs.readdirSync(partsDir).filter(f => /^b\d+\.json$/.test(f)).sort();
let added = 0;
const seen = new Set(kb.entries.map(e => e.id));
for (const f of files) {
  const arr = JSON.parse(fs.readFileSync(path.join(partsDir, f), 'utf8'));
  for (const e of arr) {
    if (!seen.has(e.id)) { kb.entries.push(e); seen.add(e.id); added++; }
  }
}
kb.version = 2;
kb._notice = 'SYNTHETIC DEMO KNOWLEDGE BASE v2 - general wellness education text for an offline assistant. It cannot diagnose, prescribe or replace a clinician. Emergency numbers in India: 112 (national), 108 (ambulance), Tele-MANAS 14416 (mental health).';
kb.refusalTriggers = ['prescribe', 'change my dose', 'should i stop taking', 'give me a prescription', 'increase my dose'];
kb.refusalAnswer = 'I cannot prescribe medicines or change your dose. Please see your prescribing doctor or pharmacist with your prescription and reports. For emergencies call 112/108 in India.';
kb.emergencyNote = 'Emergency numbers in India: 112 (national emergency), 108 (ambulance), Tele-MANAS 14416 (mental health helpline). This is general guidance, not a diagnosis.';
fs.writeFileSync(kbPath, JSON.stringify(kb, null, 2), 'utf8');
console.log('FILES=' + files.length + ' ADDED=' + added + ' TOTAL=' + kb.entries.length);
