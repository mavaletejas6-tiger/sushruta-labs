/*
 * demo-data.js - synthetic seed data loader.
 *
 * All records in this project are SYNTHETIC DEMO DATA.
 * No real people, no real medical information, no real devices.
 *
 * The canonical seeds live in data/*.json. If those files cannot be fetched
 * (for example the browser is offline before the service worker is active),
 * a compact built-in fallback keeps the demo fully functional.
 */
window.DemoData = (function () {
  'use strict';

  var CACHE = { patients: null, medicines: null, visits: null, wearables: null, kb: null, staff: null };
  var SEED_KEY = 'seedVersion';
  var SEED_VERSION = 5;
  var STAFF_KEY = 'customStaff';
  var STAFF_PREFIX = { doctor: 'DOC', nurse: 'NUR' };

  var FALLBACK_KB = {
    entries: [
      {
        id: 'kb-fallback-1', keywords: ['hba1c', 'a1c'],
        question: 'What is HbA1c?',
        answer: {
          en: 'HbA1c is a laboratory estimate of average blood glucose over roughly three months. This demo shows synthetic values only and cannot interpret your result - discuss real results with a qualified healthcare professional.',
          hi: 'HbA1c पिछले लगभग तीन महीनों के औसत रक्त शर्करा का अनुमान है। यह डेमो केवल कृत्रिम मान दिखाता है।',
          mr: 'HbA1c म्हणजे मागील साधारण तीन महिन्यांच्या सरासरी रक्तशर्करेचा अंदाज. हा डेमो केवळ नमुना माहिती दाखवतो.'
        }
      },
      {
        id: 'kb-fallback-2', keywords: ['sleep', 'rest'],
        question: 'Why is sleep important?',
        answer: {
          en: 'Sleep is when the body rests and recovers. Short or poor sleep is often linked with lower energy and higher stress the next day. This is general information, not medical advice.',
          hi: 'नींद के दौरान शरीर आराम करता है। कम नींद अगले दिन कम ऊर्जा और अधिक तनाव से जुड़ी हो सकती है। यह सामान्य जानकारी है।',
          mr: 'झोपेत शरीर विश्रांती घेते. कमी झोपेचा संबंध पुढच्या दिवशी कमी ऊर्जा व जास्त तणावाशी असतो. ही सामान्य माहिती आहे.'
        }
      },
      {
        id: 'kb-fallback-3', keywords: ['emergency', 'sos', 'unwell'],
        question: 'What should I do in an emergency?',
        answer: {
          en: 'This demo cannot contact emergency services. For a real emergency, call your local emergency number or go to the nearest hospital immediately. The SOS button in this app only creates a simulated local alert.',
          hi: 'यह डेमो आपातकालीन सेवा नहीं बुला सकता। वास्तविक आपात स्थिति में स्थानीय आपातकालीन नंबर पर कॉल करें।',
          mr: 'हा डेमो आणीबाणी सेवा कॉल करू शकत नाही. खऱ्या आपत्कालीन स्थितीत स्थानिक आणीबाणी क्रमांकावर कॉल करा.'
        }
      }
    ],
    refusalTriggers: ['do i have', 'diagnose', 'should i stop taking', 'change my dose', 'prescribe'],
    refusalAnswer: 'I cannot diagnose a condition or change your treatment. A healthcare professional can interpret your symptoms and test results. If this is an emergency, contact local emergency services or the nearest hospital.'
  };

  /* compact built-in fallback patients (only used if data/patients.json cannot load) */
  var FALLBACK_ROWS = [
    ['PT-1001', 'Synthetic Patient 01', 52, 'Female', 'O+', 'Diabetes', 81],
    ['PT-1002', 'Synthetic Patient 02', 48, 'Male', 'B+', 'Hypertension', 76],
    ['PT-1003', 'Synthetic Patient 03', 61, 'Male', 'A+', 'Heart risk', 88],
    ['PT-1004', 'Synthetic Patient 04', 57, 'Male', 'AB+', 'Diabetes', 72],
    ['PT-1005', 'Synthetic Patient 05', 34, 'Female', 'O-', 'Asthma', 84],
    ['PT-1006', 'Synthetic Patient 06', 68, 'Male', 'B-', 'COPD', 79],
    ['PT-1007', 'Synthetic Patient 07', 55, 'Female', 'A-', 'Diabetes + Hypertension', 64],
    ['PT-1008', 'Synthetic Patient 08', 29, 'Female', 'O+', 'Healthy', 100],
    ['PT-1009', 'Synthetic Patient 09', 76, 'Female', 'B+', 'Elderly wellness', 92],
    ['PT-1010', 'Synthetic Patient 10', 45, 'Male', 'A+', 'Stable', 95]
  ];
  var FALLBACK_PROFILES = {
    'PT-1001': { scenario: 'diabetes', restingHR: 74, hrv: 34, steps: 5400, sleep: 6.4, sleepQuality: 62, spo2: 97, systolic: 138, diastolic: 86, sugar: 165, rr: 16, stress: 55, trend: 'mild-up' },
    'PT-1002': { scenario: 'hypertension', restingHR: 78, hrv: 28, steps: 6200, sleep: 6.9, sleepQuality: 66, spo2: 98, systolic: 150, diastolic: 94, sugar: 104, rr: 15, stress: 60, trend: 'bp-up' },
    'PT-1003': { scenario: 'heart', restingHR: 82, hrv: 22, steps: 4300, sleep: 6.1, sleepQuality: 58, spo2: 96, systolic: 146, diastolic: 88, sugar: 118, rr: 17, stress: 66, trend: 'hrv-down' },
    'PT-1004': { scenario: 'diabetes-worsening', restingHR: 84, hrv: 24, steps: 3600, sleep: 5.8, sleepQuality: 52, spo2: 96, systolic: 144, diastolic: 90, sugar: 210, rr: 18, stress: 70, trend: 'glucose-up' },
    'PT-1005': { scenario: 'asthma', restingHR: 72, hrv: 40, steps: 8200, sleep: 7.1, sleepQuality: 70, spo2: 97, systolic: 116, diastolic: 74, sugar: 98, rr: 19, stress: 42, trend: 'stable' },
    'PT-1006': { scenario: 'copd', restingHR: 88, hrv: 18, steps: 2600, sleep: 5.9, sleepQuality: 50, spo2: 92, systolic: 134, diastolic: 82, sugar: 112, rr: 23, stress: 68, trend: 'spo2-down' },
    'PT-1007': { scenario: 'diabetes-hypertension', restingHR: 86, hrv: 20, steps: 3900, sleep: 5.7, sleepQuality: 48, spo2: 96, systolic: 164, diastolic: 100, sugar: 198, rr: 18, stress: 74, trend: 'bp-up-glucose-up' },
    'PT-1008': { scenario: 'healthy', restingHR: 64, hrv: 58, steps: 10400, sleep: 7.8, sleepQuality: 86, spo2: 99, systolic: 112, diastolic: 70, sugar: 92, rr: 14, stress: 28, trend: 'stable' },
    'PT-1009': { scenario: 'elderly', restingHR: 70, hrv: 30, steps: 4800, sleep: 7.0, sleepQuality: 68, spo2: 97, systolic: 138, diastolic: 78, sugar: 108, rr: 16, stress: 40, trend: 'mild-up' },
    'PT-1010': { scenario: 'recovered', restingHR: 70, hrv: 46, steps: 8600, sleep: 7.4, sleepQuality: 80, spo2: 98, systolic: 124, diastolic: 80, sugar: 126, rr: 15, stress: 34, trend: 'improving' }
  };

  /* ------------------------------------------------------------- helpers */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dateFromDaysAgo(days) {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - (days || 0));
    return toISO(d);
  }
  function dateFromDaysAhead(days) {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + (days || 0));
    return toISO(d);
  }
  function hash32(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function jitter(pid, day, field, amp, scale) {
    scale = scale || 1000;
    var h = hash32(pid + '#' + day + '#' + field) % (2 * scale + 1);
    return (h - scale) / scale * amp;
  }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function r0(x) { return Math.round(x); }

  /* Same algorithm as the one-time asset generator, so JSON and fallback agree. */
  function generateSeries(pid, p) {
    var out = [];
    for (var day = 0; day < 30; day++) {
      var d = day - 29;
      var sugar = p.sugar, sys = p.systolic, dia = p.diastolic, steps = p.steps,
        sleep = p.sleep, sq = p.sleepQuality, hrv = p.hrv, rh = p.restingHR,
        spo2 = p.spo2, rr = p.rr, stress = p.stress, t = p.trend;
      if (t === 'bp-up') { sys += d * 0.45; dia += d * 0.18; }
      else if (t === 'bp-up-glucose-up') { sys += d * 0.55; dia += d * 0.22; sugar += d * 1.4; steps += d * 35; sleep += d * 0.02; stress += d * 0.5; }
      else if (t === 'glucose-up') { sugar += d * 1.7; steps += d * 42; sleep += d * 0.025; stress += d * 0.4; }
      else if (t === 'spo2-down') { spo2 += d * 0.10; rr += d * 0.10; rh += d * 0.10; hrv += d * 0.25; }
      else if (t === 'hrv-down') { hrv += d * 0.35; rh += d * 0.18; stress += d * 0.35; }
      else if (t === 'improving') { steps += d * 46; sugar -= d * 1.1; stress -= d * 0.75; hrv += d * 0.40; sleep += d * 0.02; sq += d * 0.45; }
      else if (t === 'mild-up') { rh += d * 0.10; steps += d * 18; }
      var sym = [];
      if (p.scenario === 'asthma' && hash32(pid + '#' + day + '#sym') % 9 === 0) sym.push('night wheeze (synthetic)');
      if (p.scenario === 'copd' && hash32(pid + '#' + day + '#sym2') % 5 < 2) sym.push('breathless on walking (synthetic)');
      if (p.scenario === 'diabetes-worsening' && day >= 26) sym.push('increased thirst (synthetic)');
      out.push({
        daysAgo: 29 - day,
        date: dateFromDaysAgo(29 - day),
        heartRate: r0(clamp(rh + 8 + jitter(pid, day, 'hr', 7), 45, 140)),
        restingHeartRate: r0(clamp(rh + jitter(pid, day, 'rhr', 3), 40, 120)),
        hrv: r0(clamp(hrv + jitter(pid, day, 'hrv', 6), 5, 120)),
        steps: r0(clamp(steps + jitter(pid, day, 'steps', 900), 200, 25000)),
        sleepHours: Math.floor(clamp(sleep + jitter(pid, day, 'sleep', 1.1), 3, 10) * 10 + 0.5) / 10,
        sleepQuality: r0(clamp(sq + jitter(pid, day, 'sq', 8), 10, 100)),
        spo2: r0(clamp(spo2 + jitter(pid, day, 'spo2', 1), 85, 100)),
        systolicBP: r0(clamp(sys + jitter(pid, day, 'sys', 7), 90, 220)),
        diastolicBP: r0(clamp(dia + jitter(pid, day, 'dia', 5), 50, 140)),
        bloodSugar: r0(clamp(sugar + jitter(pid, day, 'sugar', 22), 60, 400)),
        respiratoryRate: r0(clamp(rr + jitter(pid, day, 'rr', 2), 8, 40)),
        stressScore: r0(clamp(stress + jitter(pid, day, 'stress', 7), 0, 100)),
        symptoms: sym
      });
    }
    return out;
  }

  /* Full condition catalogue: 9 classic + 30 added (39 total).
   * Groups drive the grouped <select> in the doctor register form and the
   * triage filter. Medicines below are SYNTHETIC DEMO PLACEHOLDERS only —
   * never prescriptions. A qualified professional must decide real treatment. */
  var CONDITIONS = [
    { name: 'Stable', group: 'General' },
    { name: 'Healthy', group: 'General' },
    { name: 'Elderly wellness', group: 'General' },
    { name: 'Diabetes', group: 'Metabolic' },
    { name: 'Hypertension', group: 'Cardiac' },
    { name: 'Diabetes + Hypertension', group: 'Metabolic' },
    { name: 'Heart risk', group: 'Cardiac' },
    { name: 'Asthma', group: 'Respiratory' },
    { name: 'COPD', group: 'Respiratory' },
    { name: 'Obesity', group: 'Metabolic' },
    { name: 'High Cholesterol', group: 'Metabolic' },
    { name: 'Hypothyroidism', group: 'Metabolic' },
    { name: 'Anemia', group: 'Blood' },
    { name: 'Iron Deficiency', group: 'Deficiency' },
    { name: 'Vitamin D Deficiency', group: 'Deficiency' },
    { name: 'Gout', group: 'Metabolic' },
    { name: 'Migraine', group: 'Neuro & Sleep' },
    { name: 'Insomnia', group: 'Neuro & Sleep' },
    { name: 'Osteoarthritis', group: 'Bone & Joint' },
    { name: 'Rheumatoid Arthritis', group: 'Bone & Joint' },
    { name: 'Osteoporosis', group: 'Bone & Joint' },
    { name: 'Chronic Back Pain', group: 'Bone & Joint' },
    { name: 'Cervical Spondylosis', group: 'Bone & Joint' },
    { name: 'Chronic Kidney Disease', group: 'Kidney & Urinary' },
    { name: 'Recurrent UTI', group: 'Kidney & Urinary' },
    { name: 'Enlarged Prostate (BPH)', group: 'Kidney & Urinary' },
    { name: 'Fatty Liver', group: 'Digestive' },
    { name: 'Acid Reflux (GERD)', group: 'Digestive' },
    { name: 'Irritable Bowel Syndrome', group: 'Digestive' },
    { name: 'Mild Depression (support)', group: 'Wellness' },
    { name: 'Mild Anxiety (support)', group: 'Wellness' },
    { name: 'Allergic Rhinitis', group: 'Respiratory' },
    { name: 'Chronic Sinusitis', group: 'Respiratory' },
    { name: 'Eczema', group: 'Skin & Allergy' },
    { name: 'Psoriasis', group: 'Skin & Allergy' },
    { name: 'PCOS', group: "Women's Health" },
    { name: 'Menopause Care', group: "Women's Health" },
    { name: 'Post-TB Follow-up', group: 'Recovery' },
    { name: 'Post-Dengue Recovery', group: 'Recovery' }
  ];
  function conditionNames() { return CONDITIONS.map(function (c) { return c.name; }); }

  function medForCondition(condition) {
    var map = {
      'Diabetes': [
        { id: 'MED-X1', name: 'Metformin', dose: '500 mg', times: ['08:00', '20:00'], instructions: 'After food (demo)', condition: 'Diabetes' }
      ],
      'Hypertension': [
        { id: 'MED-X2', name: 'Telmisartan', dose: '40 mg', times: ['08:00'], instructions: 'After breakfast (demo)', condition: 'Hypertension' }
      ],
      'Diabetes + Hypertension': [
        { id: 'MED-X3', name: 'Metformin', dose: '500 mg', times: ['08:00', '20:00'], instructions: 'After food (demo)', condition: 'Diabetes' },
        { id: 'MED-X4', name: 'Amlodipine', dose: '5 mg', times: ['08:00'], instructions: 'Same time daily (demo)', condition: 'Hypertension' }
      ],
      'Heart risk': [{ id: 'MED-X5', name: 'Aspirin', dose: '75 mg', times: ['09:00'], instructions: 'After food (demo)', condition: 'Heart risk' }],
      'Asthma': [{ id: 'MED-X6', name: 'Budesonide Inhaler', dose: '200 mcg', times: ['08:00', '20:00'], instructions: 'Inhale and rinse mouth (demo)', condition: 'Asthma' }],
      'COPD': [{ id: 'MED-X7', name: 'Tiotropium Inhaler', dose: '18 mcg', times: ['08:00'], instructions: 'One puff daily (demo)', condition: 'COPD' }],
      'Elderly wellness': [{ id: 'MED-X8', name: 'Calcium + Vitamin D3', dose: '500 mg / 250 IU', times: ['10:00'], instructions: 'After breakfast (demo)', condition: 'Bone health' }],
      'Healthy': [],
      'Stable': [{ id: 'MED-X9', name: 'Multivitamin', dose: '1 tab', times: ['10:00'], instructions: 'After breakfast (demo)', condition: 'Stable' }],
      'Obesity': [{ id: 'MED-X10', name: 'Orlistat (demo)', dose: '120 mg', times: ['12:00'], instructions: 'With lunch, low-fat diet (demo)', condition: 'Obesity' }],
      'High Cholesterol': [{ id: 'MED-X11', name: 'Atorvastatin (demo)', dose: '10 mg', times: ['21:00'], instructions: 'At bedtime (demo)', condition: 'High Cholesterol' }],
      'Hypothyroidism': [{ id: 'MED-X12', name: 'Levothyroxine (demo)', dose: '50 mcg', times: ['07:00'], instructions: 'Empty stomach (demo)', condition: 'Hypothyroidism' }],
      'Anemia': [{ id: 'MED-X13', name: 'Ferrous Sulphate (demo)', dose: '100 mg', times: ['10:00'], instructions: 'After food with vitamin C (demo)', condition: 'Anemia' }],
      'Iron Deficiency': [{ id: 'MED-X14', name: 'Iron + Folic Acid (demo)', dose: '1 tab', times: ['10:00'], instructions: 'After breakfast (demo)', condition: 'Iron Deficiency' }],
      'Vitamin D Deficiency': [{ id: 'MED-X15', name: 'Cholecalciferol (demo)', dose: '60k IU sachet', times: ['10:00 Sun'], instructions: 'Weekly with milk (demo)', condition: 'Vitamin D Deficiency' }],
      'Gout': [{ id: 'MED-X16', name: 'Allopurinol (demo)', dose: '100 mg', times: ['09:00'], instructions: 'After breakfast, plenty fluids (demo)', condition: 'Gout' }],
      'Migraine': [{ id: 'MED-X17', name: 'Flunarizine (demo)', dose: '10 mg', times: ['21:00'], instructions: 'At bedtime (demo)', condition: 'Migraine' }],
      'Insomnia': [{ id: 'MED-X18', name: 'Melatonin (demo)', dose: '3 mg', times: ['22:00'], instructions: '30 min before sleep (demo)', condition: 'Insomnia' }],
      'Osteoarthritis': [{ id: 'MED-X19', name: 'Glucosamine (demo)', dose: '500 mg', times: ['10:00'], instructions: 'After breakfast (demo)', condition: 'Osteoarthritis' }],
      'Rheumatoid Arthritis': [{ id: 'MED-X20', name: 'Methotrexate (demo)', dose: '7.5 mg weekly', times: ['Mon 09:00'], instructions: 'Weekly + folic acid (demo)', condition: 'Rheumatoid Arthritis' }],
      'Osteoporosis': [{ id: 'MED-X21', name: 'Alendronate (demo)', dose: '70 mg weekly', times: ['Sun 07:00'], instructions: 'Empty stomach, upright 30 min (demo)', condition: 'Osteoporosis' }],
      'Chronic Back Pain': [{ id: 'MED-X22', name: 'Paracetamol (demo)', dose: '650 mg', times: ['12:00'], instructions: 'After food if pain (demo)', condition: 'Chronic Back Pain' }],
      'Cervical Spondylosis': [{ id: 'MED-X23', name: 'Diclofenac Gel (demo)', dose: '1% gel', times: ['09:00', '21:00'], instructions: 'Local application (demo)', condition: 'Cervical Spondylosis' }],
      'Chronic Kidney Disease': [{ id: 'MED-X24', name: 'Sodium Bicarbonate (demo)', dose: '500 mg', times: ['08:00'], instructions: 'After food (demo)', condition: 'Chronic Kidney Disease' }],
      'Recurrent UTI': [{ id: 'MED-X25', name: 'Nitrofurantoin (demo)', dose: '100 mg', times: ['20:00'], instructions: 'After dinner, plenty fluids (demo)', condition: 'Recurrent UTI' }],
      'Enlarged Prostate (BPH)': [{ id: 'MED-X26', name: 'Tamsulosin (demo)', dose: '0.4 mg', times: ['21:00'], instructions: 'After dinner (demo)', condition: 'Enlarged Prostate (BPH)' }],
      'Fatty Liver': [{ id: 'MED-X27', name: 'Ursodeoxycholic Acid (demo)', dose: '300 mg', times: ['20:00'], instructions: 'After dinner (demo)', condition: 'Fatty Liver' }],
      'Acid Reflux (GERD)': [{ id: 'MED-X28', name: 'Omeprazole (demo)', dose: '20 mg', times: ['07:30'], instructions: 'Before breakfast (demo)', condition: 'Acid Reflux (GERD)' }],
      'Irritable Bowel Syndrome': [{ id: 'MED-X29', name: 'Mebeverine (demo)', dose: '135 mg', times: ['08:00', '20:00'], instructions: 'Before food (demo)', condition: 'Irritable Bowel Syndrome' }],
      'Mild Depression (support)': [{ id: 'MED-X30', name: 'Sertraline (demo)', dose: '25 mg', times: ['09:00'], instructions: 'Morning, counselling advised (demo)', condition: 'Mild Depression (support)' }],
      'Mild Anxiety (support)': [{ id: 'MED-X31', name: 'Escitalopram (demo)', dose: '5 mg', times: ['09:00'], instructions: 'Morning, breathing exercises (demo)', condition: 'Mild Anxiety (support)' }],
      'Allergic Rhinitis': [{ id: 'MED-X32', name: 'Cetirizine (demo)', dose: '10 mg', times: ['21:00'], instructions: 'At bedtime (demo)', condition: 'Allergic Rhinitis' }],
      'Chronic Sinusitis': [{ id: 'MED-X33', name: 'Fluticasone Nasal Spray (demo)', dose: '50 mcg', times: ['08:00'], instructions: 'One spray per nostril (demo)', condition: 'Chronic Sinusitis' }],
      'Eczema': [{ id: 'MED-X34', name: 'Hydrocortisone Cream (demo)', dose: '1% cream', times: ['09:00', '21:00'], instructions: 'Thin layer + moisturiser (demo)', condition: 'Eczema' }],
      'Psoriasis': [{ id: 'MED-X35', name: 'Calcipotriol Ointment (demo)', dose: '0.005%', times: ['09:00'], instructions: 'Local application (demo)', condition: 'Psoriasis' }],
      'PCOS': [{ id: 'MED-X36', name: 'Metformin (demo)', dose: '500 mg', times: ['20:00'], instructions: 'After dinner (demo)', condition: 'PCOS' }],
      'Menopause Care': [{ id: 'MED-X37', name: 'Calcium + Vitamin D3 (demo)', dose: '500 mg / 250 IU', times: ['10:00'], instructions: 'After breakfast (demo)', condition: 'Menopause Care' }],
      'Post-TB Follow-up': [{ id: 'MED-X38', name: 'Multivitamin (demo)', dose: '1 tab', times: ['10:00'], instructions: 'After breakfast (demo)', condition: 'Post-TB Follow-up' }],
      'Post-Dengue Recovery': [{ id: 'MED-X39', name: 'ORS + Paracetamol (demo)', dose: 'as needed', times: ['12:00'], instructions: 'Hydration + rest (demo)', condition: 'Post-Dengue Recovery' }]
    };
    return (map[condition] || []).map(function (m) { return Object.assign({}, m); });
  }

  /* Slightly varied demo baselines so each new condition gets plausible trends.
   * Values are SYNTHETIC ONLY and feed the 30-day generated series. */
  var CONDITION_PROFILES = {
    'Obesity': { scenario: 'new', restingHR: 80, hrv: 28, steps: 4200, sleep: 6.5, sleepQuality: 60, spo2: 97, systolic: 138, diastolic: 88, sugar: 118, rr: 17, stress: 58, trend: 'mild-up' },
    'High Cholesterol': { scenario: 'new', restingHR: 76, hrv: 30, steps: 5200, sleep: 6.8, sleepQuality: 64, spo2: 98, systolic: 142, diastolic: 88, sugar: 112, rr: 15, stress: 52, trend: 'mild-up' },
    'Hypothyroidism': { scenario: 'new', restingHR: 66, hrv: 34, steps: 4800, sleep: 7.6, sleepQuality: 66, spo2: 98, systolic: 128, diastolic: 82, sugar: 102, rr: 14, stress: 44, trend: 'stable' },
    'Anemia': { scenario: 'new', restingHR: 84, hrv: 26, steps: 4600, sleep: 7.0, sleepQuality: 60, spo2: 96, systolic: 112, diastolic: 70, sugar: 96, rr: 18, stress: 54, trend: 'stable' },
    'Migraine': { scenario: 'new', restingHR: 74, hrv: 32, steps: 6000, sleep: 6.2, sleepQuality: 56, spo2: 98, systolic: 126, diastolic: 80, sugar: 100, rr: 15, stress: 62, trend: 'stable' },
    'Insomnia': { scenario: 'new', restingHR: 78, hrv: 26, steps: 5400, sleep: 5.2, sleepQuality: 44, spo2: 98, systolic: 132, diastolic: 84, sugar: 106, rr: 16, stress: 68, trend: 'stable' }
  };
  function profileForCondition(condition) {
    if (CONDITION_PROFILES[condition]) return Object.assign({}, CONDITION_PROFILES[condition]);
    return { scenario: 'new', restingHR: 72, hrv: 40, steps: 6000, sleep: 7, sleepQuality: 70, spo2: 98, systolic: 122, diastolic: 78, sugar: 100, rr: 16, stress: 40, trend: 'stable' };
  }

  function labsFromProfile(p) {
    return {
      bloodGlucose: { label: 'Blood glucose (random)', value: p.sugar, unit: 'mg/dL', daysAgo: 2, range: '70-140' },
      fastingGlucose: { label: 'Fasting glucose', value: Math.round(p.sugar * 0.85), unit: 'mg/dL', daysAgo: 2, range: '70-100' },
      postMealGlucose: { label: 'Post-meal glucose', value: Math.round(p.sugar * 1.2), unit: 'mg/dL', daysAgo: 2, range: '<180' },
      hba1c: { label: 'HbA1c', value: Math.round((4.8 + (p.sugar - 90) / 45) * 10) / 10, unit: '%', daysAgo: 10, range: '4.0-5.6' },
      totalCholesterol: { label: 'Total cholesterol', value: 190, unit: 'mg/dL', daysAgo: 10, range: '<200' },
      ldl: { label: 'LDL', value: 112, unit: 'mg/dL', daysAgo: 10, range: '<100' },
      hdl: { label: 'HDL', value: 46, unit: 'mg/dL', daysAgo: 10, range: '>50' },
      triglycerides: { label: 'Triglycerides', value: 158, unit: 'mg/dL', daysAgo: 10, range: '<150' },
      creatinine: { label: 'Creatinine', value: 0.9, unit: 'mg/dL', daysAgo: 10, range: '0.6-1.1' },
      egfr: { label: 'eGFR', value: 88, unit: 'mL/min', daysAgo: 10, range: '>90' },
      systolicBP: { label: 'Systolic BP', value: p.systolic, unit: 'mmHg', daysAgo: 2, range: '<120' },
      diastolicBP: { label: 'Diastolic BP', value: p.diastolic, unit: 'mmHg', daysAgo: 2, range: '<80' },
      spo2: { label: 'SpO2', value: p.spo2, unit: '%', daysAgo: 2, range: '95-100' },
      respiratoryRate: { label: 'Respiratory rate', value: p.rr, unit: '/min', daysAgo: 2, range: '12-20' }
    };
  }

  function buildFallbackPatients() {
    return FALLBACK_ROWS.map(function (row) {
      var id = row[0], name = row[1], age = row[2], gender = row[3], bg = row[4], condition = row[5], adherence = row[6];
      var profile = FALLBACK_PROFILES[id];
      return {
        id: id, name: name, age: age, gender: gender, bloodGroup: bg,
        phone: '+91-9000000000', emergencyContact: '+91-9000000100',
        email: String(id).toLowerCase() + '@demo.local', language: 'en',
        wakePhrase: 'help me assistant 3056',
        allergies: [], diagnosis: condition === 'Healthy' ? [] : [condition + ' (synthetic demo)'],
        condition: condition,
        labs: labsFromProfile(profile),
        // Medicines are NOT auto-assigned in this demo. A doctor adds them from
        // the patient's "Medicines & adherence" section (date, time, name, schedule).
        medicines: [],
        visits: [], appointments: [], payments: [], doctorNotes: [], advice: [], alerts: [],
        timeline: [{ day: 1, title: 'Registration', detail: 'Patient registered in the demo system.', type: 'info' }],
        treatment: { condition: condition, startDaysAgo: 60, endDaysAgo: null, status: 'ongoing', summary: [] },
        wearableProfile: profile,
        adherence: { percent: adherence, last7: ['taken', 'taken', 'taken', 'missed', 'taken', 'taken', 'taken'] },
        consent: {
          given: true, dateDaysAgo: 60,
          items: { dataCollection: true, doctorSharing: true, caregiverSharing: false, camera: false, microphone: false, notifications: false, aiFeatures: true, caregiverAccess: false },
          caregiver: { name: '', phone: '', relation: '', granted: false, scope: [] }
        },
        _fallback: true
      };
    });
  }

  /* ------------------------------------------------------------- fetching */
  function fetchJson(url, timeoutMs) {
    timeoutMs = timeoutMs || 6000;
    if (typeof fetch !== 'function') return Promise.resolve(null);
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs);
    return fetch(url, ctrl ? { signal: ctrl.signal, cache: 'no-cache' } : {})
      .then(function (r) { clearTimeout(timer); return r.ok ? r.json() : null; })
      .catch(function () { clearTimeout(timer); return null; });
  }

  async function load() {
    if (CACHE.patients) return CACHE;
    var res = await Promise.all([
      fetchJson('data/patients.json'),
      fetchJson('data/medicines.json'),
      fetchJson('data/visits.json'),
      fetchJson('data/wearable-data.json'),
      fetchJson('data/knowledge-base.json')
    ]);
    CACHE.patients = res[0] && res[0].patients ? res[0].patients : buildFallbackPatients();
    CACHE.staff = (res[0] && res[0].staff) || [
      { id: 'DOC-1001', name: 'Dr. Asha Sharma', role: 'doctor', pin: '1234', speciality: 'General Medicine (synthetic demo account)' },
      { id: 'NUR-1001', name: 'Nurse Kavya Rao', role: 'nurse', pin: '5678', speciality: 'Community Health (synthetic demo account)' }
    ];
    CACHE.medicines = (res[1] && res[1].medicines) || [];
    CACHE.visits = (res[2] && res[2].visits) || [];
    CACHE.wearables = (res[3] && res[3].series) || null;
    CACHE.kb = res[4] || FALLBACK_KB;
    return CACHE;
  }

  /* -------------------------------------------------------------- seeding */
  function resolveDates(p) {
    var i;
    if (p.labs) Object.keys(p.labs).forEach(function (k) {
      var l = p.labs[k];
      if (typeof l.daysAgo === 'number') l.date = dateFromDaysAgo(l.daysAgo);
    });
    (p.visits || []).forEach(function (v) { if (typeof v.daysAgo === 'number') v.date = dateFromDaysAgo(v.daysAgo); });
    (p.appointments || []).forEach(function (a) {
      a.date = typeof a.daysAhead === 'number' ? dateFromDaysAhead(a.daysAhead) : a.date;
    });
    (p.payments || []).forEach(function (x) { if (typeof x.daysAgo === 'number') x.date = dateFromDaysAgo(x.daysAgo); });
    (p.alerts || []).forEach(function (a) {
      if (typeof a.daysAgo === 'number') a.timestamp = dateFromDaysAgo(a.daysAgo);
      a.patientId = a.patientId || p.id;
      a.id = a.id || ('ALR-' + p.id.slice(3) + '-' + Math.floor(Math.random() * 1e5));
    });
    (p.advice || []).forEach(function (a) { if (typeof a.daysAgo === 'number') a.timestamp = dateFromDaysAgo(a.daysAgo); a.patientId = a.patientId || p.id; });
    (p.doctorNotes || []).forEach(function (n) { if (typeof n.daysAgo === 'number') n.date = dateFromDaysAgo(n.daysAgo); });
    if (p.consent && typeof p.consent.dateDaysAgo === 'number') p.consent.date = dateFromDaysAgo(p.consent.dateDaysAgo);
    if (p.treatment) {
      if (typeof p.treatment.startDaysAgo === 'number') p.treatment.start = dateFromDaysAgo(p.treatment.startDaysAgo);
      if (p.treatment.endDaysAgo !== null && typeof p.treatment.endDaysAgo === 'number') p.treatment.end = dateFromDaysAgo(p.treatment.endDaysAgo);
    }
    return p;
  }

  function attachSeries(p) {
    var series = null;
    if (CACHE.wearables && CACHE.wearables[p.id]) {
      series = JSON.parse(JSON.stringify(CACHE.wearables[p.id]));
      series.forEach(function (rec) {
        rec.date = dateFromDaysAgo(rec.daysAgo);
      });
    } else {
      series = generateSeries(p.id, p.wearableProfile || FALLBACK_PROFILES[p.id] || FALLBACK_PROFILES['PT-1001']);
    }
    p.wearableData = series;
    return p;
  }

  function normalizePatient(p) {
    p.status = p.status || 'active';
    p.synthetic = true;
    if (!p.phone) p.phone = '+91-9000000000';
    if (!p.emergencyContact) p.emergencyContact = '+91-9000000100';
    if (!p.email) p.email = String(p.id || 'patient').toLowerCase().replace(/[^a-z0-9-]/g, '') + '@demo.local';
    p.wearableData = p.wearableData || [];
    p.medicines = p.medicines || [];
    p.visits = p.visits || [];
    p.appointments = p.appointments || [];
    p.payments = p.payments || [];
    p.alerts = p.alerts || [];
    p.advice = p.advice || [];
    p.doctorNotes = p.doctorNotes || [];
    p.timeline = p.timeline || [];
    p.labs = p.labs || {};
    p.allergies = p.allergies || [];
    p.diagnosis = p.diagnosis || [];
    if (p.alerts) p.alerts.forEach(function (a) { a.patientId = a.patientId || p.id; });
    if (p.advice) p.advice.forEach(function (a) { a.patientId = a.patientId || p.id; });
    return p;
  }

  async function buildSeed() {
    var c = await load();
    return c.patients.map(function (p) {
      var copy = JSON.parse(JSON.stringify(p));
      normalizePatient(copy);
      resolveDates(copy);
      attachSeries(copy);
      return copy;
    });
  }

  function defaultContactFor(p) {
    var n = '0000';
    try {
      var m = String(p && p.id || '').match(/(\d+)\s*$/);
      if (m) n = m[1].slice(-4);
      while (n.length < 4) n = '0' + n;
    } catch (e) { /* keep default */ }
    return {
      phone: '+91-900000' + n,
      emergency: '+91-90000001' + String(n).slice(-2),
      email: String((p && p.id) || 'patient').toLowerCase().replace(/[^a-z0-9-]/g, '') + '@demo.local'
    };
  }

  // Backfills missing phone / emergencyContact / email on records that were
  // seeded before those fields existed. Never overwrites a value the user
  // (or doctor) has already set. Returns the (possibly updated) list.
  async function migrateContactFields(list) {
    var changed = 0;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p || !p.id) continue;
      var d = defaultContactFor(p);
      var dirty = false;
      if (!p.phone || !String(p.phone).trim()) { p.phone = d.phone; dirty = true; }
      if (!p.emergencyContact || !String(p.emergencyContact).trim()) { p.emergencyContact = d.emergency; dirty = true; }
      if (!p.email || !String(p.email).trim()) { p.email = d.email; dirty = true; }
      if (dirty) {
        try {
          await Storage.savePatient(p);
          changed++;
        } catch (e) { /* keep going — one bad record must not block boot */ }
      }
    }
    if (changed > 0) {
      try {
        await Storage.saveAuditLog({
          actorId: 'system', actorRole: 'system', action: 'contact.migrated',
          patientId: null,
          message: 'Auto-migrated contact fields (phone/email) for ' + changed + ' existing demo patient(s). No reset needed. SYNTHETIC DEMO DATA.'
        });
      } catch (e) { /* audit must never break boot */ }
    }
    return list;
  }

  // One-time migration (seed v5): demo medicines are no longer auto-assigned to
  // patients. Medicines are added only by a doctor from the Medicines section.
  // Clears any previously auto-seeded demo medicines so no browser keeps them,
  // without touching the rest of the synthetic patient record.
  async function migrateClearAutoMedicines(list) {
    var cleared = 0;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p || !p.id) continue;
      if (p.medicines && p.medicines.length) {
        p.medicines = [];
        try {
          await Storage.savePatient(p);
          cleared++;
        } catch (e) { /* keep going — one bad record must not block boot */ }
      }
    }
    if (cleared > 0) {
      try {
        await Storage.saveAuditLog({
          actorId: 'system', actorRole: 'system', action: 'medicine.autoseed.removed',
          patientId: null,
          message: 'Removed auto-assigned demo medicines for ' + cleared + ' patient(s). Medicines are now added only by a doctor. SYNTHETIC DEMO DATA.'
        });
      } catch (e) { /* audit must never break boot */ }
    }
    return list;
  }

  async function ensureSeeded() {
    var existing = await Storage.getAllPatients();
    var storedVersion = parseInt(Storage.getSetting(SEED_KEY, 0), 10) || 0;
    if (existing.length > 0) {
      // Auto-migrate old local records: backfill phone / emergency / email
      // so existing browsers never need a manual "Reset Demo".
      var migrated = await migrateContactFields(existing);
      // Seed v5: drop the old auto-assigned demo medicines once.
      if (storedVersion < SEED_VERSION) {
        migrated = await migrateClearAutoMedicines(migrated);
      }
      Storage.setSetting(SEED_KEY, SEED_VERSION);
      return migrated;
    }
    var seed = await buildSeed();
    for (var i = 0; i < seed.length; i++) await Storage.savePatient(seed[i]);
    Storage.setSetting(SEED_KEY, SEED_VERSION);
    await Storage.saveAuditLog({
      actorId: 'system', actorRole: 'system', action: 'seed',
      patientId: null, message: 'Synthetic demo dataset seeded (' + seed.length + ' patients). SYNTHETIC DEMO DATA.'
    });
    return seed;
  }

  async function resetDemo() {
    for (var i = 0; i < Storage._stores.length; i++) await Storage.clearLocalStore(Storage._stores[i]);
    Storage.removeSetting(SEED_KEY);
    Storage.removeSetting(STAFF_KEY);
    Storage.removeSetting('session');
    CACHE.patients = null;
    return ensureSeeded();
  }

  /* ----------------------------------------------------- care team / staff */
  function staffRoleLabel(role) {
    if (role === 'nurse') return 'Nurse';
    if (role === 'doctor') return 'Doctor';
    return 'Staff';
  }
  function customStaffList() {
    var list = Storage.getSetting(STAFF_KEY, []);
    return Object.prototype.toString.call(list) === '[object Array]' ? list : [];
  }
  function saveCustomStaff(list) { Storage.setSetting(STAFF_KEY, list || []); }
  function staffNum(id, prefix) {
    var m = String(id || '').toUpperCase().match(new RegExp('^' + prefix + '-(\\d+)$'));
    return m ? parseInt(m[1], 10) : 0;
  }
  /* Sequential staff IDs only: DOC-1002, NUR-1002, … — never random. */
  function nextStaffId(existing, role) {
    var prefix = STAFF_PREFIX[role] || 'STF';
    var max = 1000;
    (existing || []).forEach(function (s) {
      var n = staffNum(s && s.id, prefix);
      if (n > max) max = n;
    });
    var seen = {};
    (existing || []).forEach(function (s) { if (s && s.id) seen[String(s.id).toUpperCase()] = true; });
    var c = max + 1;
    while (seen[prefix + '-' + c]) c++;
    return prefix + '-' + c;
  }
  async function baseStaffList() { var c = await load(); return c.staff || []; }
  async function getStaff() {
    var base = await baseStaffList();
    return base.concat(customStaffList());
  }
  /* Add a care-team account (doctor/nurse) to the local demo store. */
  async function addStaff(entry) {
    entry = entry || {};
    var name = String(entry.name || '').trim();
    if (!name) throw new Error('A full name is required.');
    var role = entry.role === 'nurse' ? 'nurse' : 'doctor';
    var pin = String(entry.pin == null ? '' : entry.pin).trim();
    if (!/^\d{4,8}$/.test(pin)) throw new Error('The PIN must be 4–8 digits.');
    var all = await getStaff();
    var id = String(entry.id || '').trim().toUpperCase();
    if (id) {
      var dup = all.some(function (s) { return String(s.id).toUpperCase() === id; });
      if (dup) throw new Error('Staff ID ' + id + ' already exists.');
    } else {
      id = nextStaffId(all, role);
    }
    var rec = {
      id: id,
      name: name,
      role: role,
      pin: pin,
      speciality: String(entry.speciality || '').trim() || (staffRoleLabel(role) + ' (added in demo)'),
      custom: true,
      addedAt: new Date().toISOString()
    };
    var custom = customStaffList();
    custom.push(rec);
    saveCustomStaff(custom);
    return rec;
  }
  /* Remove a locally-added account. Built-in demo accounts cannot be removed. */
  async function removeStaff(id) {
    var target = String(id || '').toUpperCase();
    var custom = customStaffList();
    var kept = custom.filter(function (s) { return String(s.id).toUpperCase() !== target; });
    if (kept.length === custom.length) return false;
    saveCustomStaff(kept);
    return true;
  }

  /* -------------------------------------------------------- access helpers */
  function todayVitals(p) {
    if (!p || !p.wearableData || !p.wearableData.length) return null;
    return p.wearableData[p.wearableData.length - 1];
  }
  function series(p, days) {
    if (!p || !p.wearableData) return [];
    var n = Math.min(days || 30, p.wearableData.length);
    return p.wearableData.slice(p.wearableData.length - n);
  }
  function lab(p, key) { return (p && p.labs && p.labs[key]) ? p.labs[key] : null; }

  return {
    load: load,
    ensureSeeded: ensureSeeded,
    buildSeed: buildSeed,
    resetDemo: resetDemo,
    migrateContactFields: migrateContactFields,
    dateFromDaysAgo: dateFromDaysAgo,
    dateFromDaysAhead: dateFromDaysAhead,
    generateSeries: generateSeries,
    todayVitals: todayVitals,
    series: series,
    lab: lab,
    CONDITIONS: CONDITIONS,
    conditionNames: conditionNames,
    medForCondition: medForCondition,
    profileForCondition: profileForCondition,
    getKB: async function () { var c = await load(); return c.kb || FALLBACK_KB; },
    getStaff: getStaff,
    addStaff: addStaff,
    removeStaff: removeStaff,
    nextStaffId: nextStaffId,
    staffRoleLabel: staffRoleLabel,
    getMedCatalogue: async function () { var c = await load(); return c.medicines; },
    getVisitList: async function () { var c = await load(); return c.visits; },
    SOURCES_NOTE: 'SYNTHETIC DEMO DATA - demo for education only, not medical advice.'
  };
})();
