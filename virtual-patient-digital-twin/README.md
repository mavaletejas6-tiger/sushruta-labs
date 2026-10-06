# Virtual Patient Digital Twin — demo PWA

An offline-first, framework-free demonstration of a "digital twin" for chronic-care
patients: synthetic EHR + wearable data, an **explainable rule-based risk engine**,
a patient app, a doctor/nurse triage dashboard, a consent-gated caregiver view, and
QR-verifiable demonstration certificates.

**Demo for education only, not medical advice.**
**AI suggestions are not medical diagnoses. A qualified healthcare professional must
make clinical decisions.**

Everything is synthetic. There is no server, no database, no real SMS, no real call,
no real payment and no real biometric check — the app runs entirely in the browser
using IndexedDB (with a `localStorage` fallback).

---

## Quick start

```bash
cd virtual-patient-digital-twin
python -m http.server 8000
```

Open <http://localhost:8000>

> A service worker needs a secure context: `http://localhost` counts as secure, so
> offline caching and "Install app" work there. Any static host works too — there is
> no build step.

---

## Demo accounts

| Role | ID | PIN | Notes |
|---|---|---|---|
| Doctor | `DOC-1001` | `1234` | Full triage, advice approval, certificates, admin |
| Nurse | `NUR-1001` | `5678` | View + notes; RED-risk advice is escalated, not sent |
| Patient | `PT-1001` … `PT-1010` | none | Demo mode: open directly from the patient page |
| Caregiver | — | — | Consent-gated view, no login in this demo |

Optional passkey (real WebAuthn, local only): create it from the home page →
**Create demo passkey**, then "Try passkey" on the doctor login. "Passkey verified"
is only ever shown after an actual WebAuthn assertion; otherwise the UI says so and
falls back to the PIN.

Wake phrase for the voice assistant: `help me assistant 3056`.

---

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Landing, credentials, risk-engine explanation, test events, guided demo, privacy/about/limitations |
| `patient.html` | Login gate, onboarding, consent, dashboard, medicines, timeline, history, assistant, settings, SOS |
| `doctor.html` | Staff login, auto-lock, triage list (RED → YELLOW → GREEN), filters/sort, one-page patient summary, advice templates + **Approve & Send**, broadcast, audit log, mock teleconsultation, certificates, archive/deceased/delete |
| `caregiver.html` | Consent-gated view: medicines, appointments, red alerts, basic wellness only |
| `certificate.html?id=…` | Printable demonstration certificate + QR (A4 print CSS) |
| `verification.html?id=…` | QR target page: found / not-found with required disclaimers |

---

## Guided demo (11 steps)

Home → **RUN DIGITAL TWIN DEMO**. Progress is saved locally and continues across
pages (`?demo=1`), so the flow works on one screen during a pitch.

1. Wearable/EHR data arrives for `PT-1004`
2. The rule engine scores it
3. A synthetic high-glucose event pushes the twin to **RED**
4. The alert appears in the doctor triage list
5. Open the patient profile
6. Review demographics, labs, 30-day charts and the explainable breakdown
7. The system proposes an advice **draft**
8. The doctor edits and clicks **Approve & Send** (human approval is mandatory)
9. The patient dashboard receives the advice
10. The patient reads / acknowledges / books a consultation

Exit any time with **Exit demo** in the overlay.

---

## Testing checklist

- [ ] `python -m http.server 8000` → home page renders, no console errors
- [ ] Log in as doctor `DOC-1001` / `1234` → triage board shows 10 patients with counts
- [ ] Filter by 🔴 / 🟡 / 🟢 and by condition; sort by risk / name / ID
- [ ] Open a patient → labs, wearable row, 30-day chart, risk reasons and domain table
- [ ] Generate a test event (high glucose / BP / low SpO2) → patient goes RED, alert listed
- [ ] Approve advice → confirm dialog → it appears in the patient inbox
- [ ] Nurse account cannot approve RED advice (escalation message + audit entry)
- [ ] Generate a certificate → open `certificate.html?id=…` → QR renders → scan/verify page
- [ ] Audit log shows every action with actor, role and patient
- [ ] Toggle **Simulate offline** → queue builds, **Sync now** drains it (simulated)
- [ ] Dark mode, `EN / हिन्दी / मराठी`, and mobile width (bottom navigation) all work
- [ ] Patient consent off → caregiver view is blocked and logs the denial
- [ ] Auto-lock: doctor/nurse session locks after 5 minutes of inactivity (demo policy)
- [ ] `Reset demo` restores the original synthetic dataset

---

## Project layout

```
virtual-patient-digital-twin/
├── index.html  patient.html  doctor.html  caregiver.html
├── certificate.html  verification.html
├── manifest.json  service-worker.js
├── css/   style.css  responsive.css  print.css
├── js/
│   ├── storage.js        IndexedDB + localStorage abstraction, sync queue, audit
│   ├── demo-data.js      synthetic seed loading + series generation
│   ├── risk.js           explainable demo risk engine (no ML, no validation claim)
│   ├── app.js            i18n, theme, toasts/modals, charts, PWA, guided demo
│   ├── auth.js           staff PIN, WebAuthn, sessions, idle auto-lock
│   ├── sync.js           SIMULATED offline/online sync queue
│   ├── notifications.js  local notification demo
│   ├── speech.js         wake phrase, TTS, SIMULATED emergency countdown
│   ├── assistant.js      offline knowledge base + optional local Ollama
│   ├── qr.js             self-contained QR encoder (byte mode, EC level L, v1–10)
│   ├── certificate.js    demonstration certificate builder/renderer
│   ├── patient.js  doctor.js  caregiver.js
├── data/    patients  medicines  visits  wearable-data  knowledge-base (all synthetic)
└── assets/  icons + short wav sounds
```

Storage is only ever touched through `Storage.*` (`js/storage.js`). All writes go
through IndexedDB when available and mirror into `vpdt:`-prefixed `localStorage`
otherwise, so the demo survives a hard refresh.

---

## Design commitments

- **Explainable, not magic:** every score lists the demo rules that contributed
  (`Risk.assess().reasons`, `.breakdown`, `Risk.HOW_IT_WORKS`). No ML model is used
  or implied.
- **Human in the loop:** high-risk advice is never auto-sent; a named approver and
  an audit entry are required.
- **Consent & data minimisation:** caregivers see only medicines, appointments,
  alerts and basic wellness, and only while the patient keeps sharing enabled.
- **Honesty about capability:** no fake "biometric verified", no real SMS/call/
  payment; simulations are labelled SIMULATED/mock everywhere they occur.
- **Accessibility:** 44px touch targets, visible focus rings, status shown by text
  as well as colour, skip link, ARIA labels.
- **Safety copy** appears on every page (notice bar, disclaimer box, footer).

---

## Limitations (read before showing this anywhere)

- Synthetic data only; nothing here is a real patient, record, lab or device reading.
- The risk engine is a **demo rule set**, not a clinically validated model, and not
  a medical device. It must not be used for diagnosis, treatment, emergency
  decisions or medication changes.
- There is no backend: "sync", SMS, phone calls, video calls and payments
  are simulations.
- Certificates are demonstration documents — not medical or legal documents — and
  are stored only in the browser that generated them (so a QR scanned elsewhere
  reports "not found" by design).
- WebAuthn/passkeys depend on the browser and device; PIN is the demo fallback.
- The optional local AI (`assistant.js`) can talk to an Ollama instance on
  `localhost:11434` if one is running; otherwise it uses the offline knowledge base.
  Either way it refuses to diagnose.

Reset everything from the home page (**Reset demo**) or the doctor dashboard.
