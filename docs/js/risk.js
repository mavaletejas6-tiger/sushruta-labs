/*
 * risk.js - DEMO RULE-BASED RISK ENGINE
 *
 * IMPORTANT TRANSPARENCY STATEMENT
 * ---------------------------------------------------------------------------
 * This prototype uses deterministic JavaScript rules.
 * It does NOT use a clinically validated machine-learning model.
 * Inputs : synthetic wearable data + synthetic EHR data (data/*.json)
 * Output : demo risk score (0-100) + level + reasons + suggested actions
 * Purpose: education and prototype demonstration only.
 *
 * "Demo for education only, not medical advice."
 * "AI suggestions are not medical diagnoses. A qualified healthcare professional
 *  must make clinical decisions."
 * ---------------------------------------------------------------------------
 */
window.Risk = (function () {
  'use strict';

  var THRESHOLDS = {
    green: 0,
    yellow: 40,
    red: 70,
    demoNote: 'Rule-based demo thresholds - not clinically validated cut-offs.'
  };

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function round(v) { return Math.round(v); }
  function avg(list) {
    if (!list.length) return 0;
    return list.reduce(function (a, b) { return a + b; }, 0) / list.length;
  }
  function levelOf(score) {
    if (score >= THRESHOLDS.red) return 'red';
    if (score >= THRESHOLDS.yellow) return 'yellow';
    return 'green';
  }
  function levelLabel(level) {
    return level === 'red' ? 'RED - Act Now' : level === 'yellow' ? 'YELLOW - Watch' : 'GREEN - Stable';
  }

  function lastDays(p, n) {
    var s = (p.wearableData || []);
    return s.slice(Math.max(0, s.length - n));
  }

  function conditionHas(p, word) {
    var hay = ((p.condition || '') + ' ' + (p.diagnosis || []).join(' ')).toLowerCase();
    return hay.indexOf(word.toLowerCase()) !== -1;
  }

  function labVal(p, key) {
    var l = p.labs && p.labs[key];
    return l && typeof l.value === 'number' ? l.value : null;
  }

  /* ---------------------------------------------------------- sub-scoring */
  function diabetesRisk(p, days) {
    var d = lastDays(p, days || 7);
    var reasons = [], actions = [];
    var score = 10;
    var sugars = d.map(function (x) { return x.bloodSugar; });
    var avgSugar = avg(sugars);
    var highs = sugars.filter(function (s) { return s > 180; }).length;

    if (avgSugar > 180) { score += 28; reasons.push('Average demo glucose ' + round(avgSugar) + ' mg/dL over last ' + sugars.length + ' readings (demo threshold 180)'); }
    else if (avgSugar > 140) { score += 16; reasons.push('Average demo glucose ' + round(avgSugar) + ' mg/dL above demo target band'); }
    else if (avgSugar > 120) { score += 8; reasons.push('Average demo glucose ' + round(avgSugar) + ' mg/dL slightly above demo band'); }

    if (highs >= 3) { score += 18; reasons.push(highs + ' of the last ' + sugars.length + ' readings were above 180 mg/dL (repeated elevated values)'); }
    else if (highs > 0) { score += 8; reasons.push(highs + ' elevated demo glucose reading(s) detected'); }

    var a1c = labVal(p, 'hba1c');
    if (a1c !== null) {
      if (a1c >= 8) { score += 25; reasons.push('HbA1c ' + a1c + '% (demo lab value is at or above 8%)'); }
      else if (a1c >= 7) { score += 15; reasons.push('HbA1c ' + a1c + '% (demo lab value above 7%)'); }
      else if (a1c >= 6.5) { score += 8; reasons.push('HbA1c ' + a1c + '% (demo lab value in 6.5-7% band)'); }
    }

    var steps = d.length ? d[d.length - 1].steps : 0;
    if (steps < 4000) { score += 10; reasons.push('Low activity: ' + steps + ' steps today (demo threshold <4000)'); actions.push('Add a short daily walk if your clinician agrees'); }
    else if (steps < 6000) { score += 5; reasons.push('Activity below demo band: ' + steps + ' steps today'); }

    var sleep = d.length ? avg(d.map(function (x) { return x.sleepHours; })) : 7;
    if (sleep < 6) { score += 10; reasons.push('Poor sleep: average ' + sleep.toFixed(1) + ' h over the window'); actions.push('Review sleep routine with your care team'); }
    else if (sleep < 7) { score += 5; reasons.push('Sleep below demo band: average ' + sleep.toFixed(1) + ' h'); }

    var adh = (p.adherence && p.adherence.percent) || 0;
    if (p.medicines && p.medicines.length) {
      if (adh < 70) { score += 15; reasons.push('Medication adherence ' + adh + '% in the demo log'); actions.push('Review missed doses with a nurse or pharmacist'); }
      else if (adh < 85) { score += 8; reasons.push('Medication adherence ' + adh + '% (below demo target 85%)'); }
    }
    if (conditionHas(p, 'diabet')) reasons.push('Synthetic EHR history includes diabetes diagnosis');

    if (!actions.length) actions.push('Continue monitoring as advised');
    return { key: 'diabetes', label: 'Demo diabetes / glucose risk', score: clamp(score, 0, 100), reasons: reasons, suggestedActions: actions };
  }

  function cardioRisk(p, days) {
    var d = lastDays(p, days || 7);
    var reasons = [], actions = [];
    var score = 8;
    var sys = avg(d.map(function (x) { return x.systolicBP; }));
    var dia = avg(d.map(function (x) { return x.diastolicBP; }));

    if (sys >= 160) { score += 30; reasons.push('Average demo systolic BP ' + round(sys) + ' mmHg (>=160 demo band)'); actions.push('Doctor review of blood pressure trend recommended'); }
    else if (sys >= 140) { score += 20; reasons.push('Average demo systolic BP ' + round(sys) + ' mmHg (>=140 demo band)'); }
    else if (sys >= 130) { score += 10; reasons.push('Average demo systolic BP ' + round(sys) + ' mmHg (>=130 demo band)'); }

    if (dia >= 100) { score += 20; reasons.push('Average demo diastolic BP ' + round(dia) + ' mmHg (>=100 demo band)'); }
    else if (dia >= 90) { score += 12; reasons.push('Average demo diastolic BP ' + round(dia) + ' mmHg (>=90 demo band)'); }
    else if (dia >= 85) { score += 6; reasons.push('Average demo diastolic BP ' + round(dia) + ' mmHg (>=85 demo band)'); }

    var hrv = d.length ? d[d.length - 1].hrv : 40;
    if (hrv < 25) { score += 12; reasons.push('Reduced HRV: ' + hrv + ' ms (demo threshold <25)'); }
    else if (hrv < 35) { score += 6; reasons.push('HRV below demo band: ' + hrv + ' ms'); }

    var rhr = d.length ? d[d.length - 1].restingHeartRate : 70;
    if (rhr > 80) { score += 8; reasons.push('Elevated resting heart rate ' + rhr + ' bpm'); }
    else if (rhr > 75) { score += 4; reasons.push('Resting heart rate ' + rhr + ' bpm above demo band'); }

    if (conditionHas(p, 'heart') || conditionHas(p, 'hypertension')) {
      score += 10;
      reasons.push('Synthetic EHR history includes cardiovascular/blood-pressure diagnosis');
    }
    var ldl = labVal(p, 'ldl');
    if (ldl !== null && ldl >= 130) { score += 8; reasons.push('LDL ' + ldl + ' mg/dL above demo band'); }

    var adh = (p.adherence && p.adherence.percent) || 0;
    if (p.medicines && p.medicines.length) {
      if (adh < 70) { score += 10; reasons.push('Medication adherence ' + adh + '% in the demo log'); actions.push('Confirm BP medicines are being taken as prescribed (demo)'); }
      else if (adh < 85) { score += 5; reasons.push('Medication adherence ' + adh + '% (below demo target)'); }
    }
    if (!actions.length) actions.push('Keep home BP readings and share trends with your clinician');
    return { key: 'cardio', label: 'Demo hypertension / heart risk', score: clamp(score, 0, 100), reasons: reasons, suggestedActions: actions };
  }

  function respiratoryRisk(p, days) {
    var d = lastDays(p, days || 7);
    var reasons = [], actions = [];
    var score = 5;
    var last = d[d.length - 1] || {};
    var spo2 = last.spo2 || 98;
    var rr = last.respiratoryRate || 16;

    if (spo2 < 92) { score += 35; reasons.push('SpO2 ' + spo2 + '% (demo threshold <92%)'); actions.push('Seek prompt medical review - demo recommendation'); }
    else if (spo2 < 94) { score += 25; reasons.push('SpO2 ' + spo2 + '% below demo band (<94%)'); actions.push('Doctor review recommended'); }
    else if (spo2 < 95) { score += 10; reasons.push('SpO2 ' + spo2 + '% at the edge of the demo band'); }

    if (rr > 24) { score += 20; reasons.push('Respiratory rate ' + rr + '/min (demo threshold >24)'); }
    else if (rr > 20) { score += 10; reasons.push('Respiratory rate ' + rr + '/min above demo band'); }

    var syms = 0;
    d.forEach(function (x) { syms += (x.symptoms || []).length; });
    if (syms > 0) { score += Math.min(16, syms * 8); reasons.push(syms + ' synthetic respiratory symptom entries in the last ' + d.length + ' days'); }

    if (conditionHas(p, 'asthma') || conditionHas(p, 'copd')) {
      score += 8;
      reasons.push('Synthetic EHR history includes asthma/COPD diagnosis');
    }
    if (!actions.length) actions.push('No demo respiratory alerts - continue as advised');
    return { key: 'respiratory', label: 'Demo asthma / COPD risk', score: clamp(score, 0, 100), reasons: reasons, suggestedActions: actions };
  }

  function stressRisk(p, days) {
    var d = lastDays(p, days || 7);
    var last = d[d.length - 1] || {};
    var score = clamp((last.stressScore || 50) + (avg(d.map(function (x) { return x.sleepHours; })) < 6 ? 10 : 0) - ((last.hrv || 40) > 50 ? 10 : 0), 0, 100);
    var reasons = [];
    if (score >= 70) reasons.push('Demo stress score ' + score + '/100 with poor sleep window');
    else if (score >= 45) reasons.push('Demo stress score ' + score + '/100');
    else reasons.push('Demo stress score ' + score + '/100 (low band)');
    return {
      key: 'stress', label: 'Demo stress score', score: round(score), reasons: reasons,
      suggestedActions: score >= 70 ? ['Consider relaxation time and discuss persistent stress with a professional'] : ['Maintain current routine']
    };
  }

  function adherenceRisk(p) {
    var adh = (p.adherence && p.adherence.percent);
    if (adh === undefined || adh === null) adh = 100;
    if (!p.medicines || !p.medicines.length) adh = 100;
    var score = clamp(100 - adh, 0, 100);
    var reasons = [adh + '% medicine adherence in the demo log' + (p.medicines && p.medicines.length ? '' : ' (no medicines scheduled)')];
    var actions = adh < 70 ? ['Nurse follow-up on missed doses recommended'] : ['Keep using reminders'];
    return { key: 'adherence', label: 'Demo medication adherence risk', score: score, reasons: reasons, suggestedActions: actions };
  }

  /* -------------------------------------------------------------- wellness */
  function wellness(p, days) {
    var d = lastDays(p, days || 1);
    var last = d[d.length - 1];
    if (!last) return { score: 0, factors: [], note: 'No wearable data available' };
    var sleepN = clamp((last.sleepHours - 4) / (9 - 4) * 100, 0, 100);
    var activityN = clamp(last.steps / 10000 * 100, 0, 100);
    var hrvN = clamp((last.hrv - 10) / (80 - 10) * 100, 0, 100);
    var stressN = clamp(100 - last.stressScore, 0, 100);
    var score = round(0.40 * sleepN + 0.30 * activityN + 0.20 * hrvN + 0.10 * stressN);
    return {
      score: clamp(score, 0, 100),
      factors: [
        { key: 'sleep', label: 'Sleep (40%)', raw: last.sleepHours + ' h', normalized: round(sleepN) },
        { key: 'activity', label: 'Activity (30%)', raw: last.steps.toLocaleString() + ' steps', normalized: round(activityN) },
        { key: 'hrv', label: 'HRV (20%)', raw: last.hrv + ' ms', normalized: round(hrvN) },
        { key: 'stress', label: 'Stress inverse (10%)', raw: last.stressScore + '/100', normalized: round(stressN) }
      ],
      note: 'Demo wellness score - not a clinical measurement.'
    };
  }

  /* ------------------------------------------------------- overall assess */
  function assess(p, opts) {
    opts = opts || {};
    var days = opts.days || 7;
    var parts = [
      diabetesRisk(p, days),
      cardioRisk(p, days),
      respiratoryRisk(p, days),
      stressRisk(p, days),
      adherenceRisk(p)
    ];
    var weights = { diabetes: 0.28, cardio: 0.28, respiratory: 0.18, stress: 0.12, adherence: 0.14 };
    var wsum = 0, acc = 0, maxPart = parts[0];
    parts.forEach(function (part) {
      wsum += weights[part.key];
      acc += weights[part.key] * part.score;
      if (part.score > maxPart.score) maxPart = part;
    });
    var base = acc / wsum;
    var score = clamp(round(Math.max(base, maxPart.score - 10)), 0, 100);
    var level = levelOf(score);

    var reasons = [], actions = [];
    parts.forEach(function (part) {
      if (part.score >= 40) {
        part.reasons.forEach(function (r) { reasons.push(part.label + ': ' + r); });
        part.suggestedActions.forEach(function (a) { if (actions.indexOf(a) === -1) actions.push(a); });
      }
    });
    if (!reasons.length) parts.forEach(function (part) { part.reasons.slice(0, 1).forEach(function (r) { reasons.push(part.label + ': ' + r); }); });
    if (level === 'red') actions.unshift('RED - review by a qualified healthcare professional is suggested (demo rule)');
    else if (level === 'yellow') actions.unshift('YELLOW - watch and keep monitoring (demo rule)');
    if (!actions.length) actions.push('Continue current routine and monitoring (demo rule)');

    var w = wellness(p, opts.wellnessDays || 1);

    return {
      score: score,
      level: level,
      levelLabel: levelLabel(level),
      reasons: reasons,
      suggestedActions: actions,
      timestamp: new Date().toISOString(),
      topDomain: maxPart.key,
      topDomainLabel: maxPart.label,
      breakdown: parts,
      wellness: w,
      disclaimer: 'Demo rule-based prediction, not a validated medical model. Not a diagnosis.'
    };
  }

  /* trend between two assessments (used by timeline + what-if) */
  function assessOffset(p, daysBack) {
    var copy = JSON.parse(JSON.stringify(p));
    if (copy.wearableData && copy.wearableData.length > daysBack) {
      copy.wearableData = copy.wearableData.slice(0, copy.wearableData.length - daysBack);
    }
    return assess(copy, {});
  }

  var HOW_IT_WORKS = [
    'This prototype uses deterministic JavaScript rules.',
    'It does NOT use a clinically validated machine-learning model.',
    'Inputs: wearable data + synthetic EHR data',
    'Output: demo risk score (0-100), level, reasons and suggested actions',
    'Every score lists its contributing factors so the result is explainable',
    'Purpose: education and prototype demonstration'
  ].join('\n');

  return {
    assess: assess,
    assessOffset: assessOffset,
    wellness: wellness,
    levelOf: levelOf,
    levelLabel: levelLabel,
    THRESHOLDS: THRESHOLDS,
    HOW_IT_WORKS: HOW_IT_WORKS,
    subScores: function (p, days) {
      return {
        diabetes: diabetesRisk(p, days || 7),
        cardio: cardioRisk(p, days || 7),
        respiratory: respiratoryRisk(p, days || 7),
        stress: stressRisk(p, days || 7),
        adherence: adherenceRisk(p)
      };
    }
  };
})();
