/* sistema-icons.js - the SYSTEMA icon set, as inline SVG markup.
 *
 * Replaces the emoji that were scattered through the markup (🏠 💊 📜 ⚙️ …).
 * Why hand-drawn inline SVG instead of an icon font or a sprite file:
 *   - the app is offline-first with no build step, so icons must ship as source
 *     text that renders identically from file:// and from http://;
 *   - `<use href="sprite.svg#id">` needs a network fetch and renders nothing at
 *     all when the service worker has not cached the sprite yet;
 *   - every glyph inherits `currentColor`, so icons follow the active theme.
 *
 * Style rules, so the set reads as one family:
 *   - 24x24 grid, 1.7px stroke, round caps and joins;
 *   - geometry in currentColor, focal accent as a gold dot (class "si-dot"),
 *     echoing the gold boss at the centre of the SYSTEMA roundel.
 *
 * Call sites use App.icon(name, className) -> markup string, which stays
 * readable inside the template literals that build most of this UI.
 */
(function (global) {
  'use strict';

  /* Shared accent: the gold focal dot repeated across the family. */
  var DOT = '<circle class="si-dot" cx="12" cy="12" r="1.6"/>';

  var P = {
    /* ---- navigation ------------------------------------------------------ */
    dashboard:
      '<path d="M4 11.2 12 4.6l8 6.6"/>' +
      '<path d="M6 10.6V19a1 1 0 0 0 1 1h3.4v-4.6h3.2V20H17a1 1 0 0 0 1-1v-8.4"/>',
    medicines:
      '<rect x="3.1" y="8.6" width="17.8" height="6.8" rx="3.4" transform="rotate(-45 12 12)"/>' +
      '<path d="M8.4 8.4 15.6 15.6"/>',
    timeline:
      '<path d="M7 3.6v16.8"/>' +
      '<circle class="si-dot" cx="7" cy="7.4" r="1.7"/>' +
      '<circle cx="7" cy="12" r="1.5"/>' +
      '<circle cx="7" cy="16.6" r="1.5"/>' +
      '<path d="M10.8 7.4h8.6M10.8 12h6.2M10.8 16.6h4.4"/>',
    history:
      '<path d="M3.9 12a8.1 8.1 0 1 0 2.5-5.8"/>' +
      '<path d="M3.5 4.4v3.9h3.9"/>' +
      '<path d="M12 7.6V12l3.1 2"/>',
    assistant:
      '<rect x="4.4" y="7.8" width="15.2" height="11.4" rx="3.2"/>' +
      '<path d="M12 3.4v4.4"/>' + DOT +
      '<path d="M2.6 12.4v3M21.4 12.4v3"/>' +
      '<path d="M9.6 19.2v1.6M14.4 19.2v1.6"/>',
    settings:
      '<circle cx="12" cy="12" r="3.1"/>' +
      '<path d="M12 2.9v2.6M12 18.5v2.6M4.5 7.8l2.3 1.3M17.2 14.9l2.3 1.3M4.5 16.2l2.3-1.3M17.2 9.1l2.3-1.3"/>',
    logout:
      '<path d="M14.2 4.4H6.6a1.6 1.6 0 0 0-1.6 1.6v12a1.6 1.6 0 0 0 1.6 1.6h7.6"/>' +
      '<path d="M17.4 8.4 21 12l-3.6 3.6M21 12H10"/>',

    /* ---- clinical -------------------------------------------------------- */
    stethoscope:
      '<path d="M6.3 3.6v5.1a4.2 4.2 0 0 0 8.4 0V3.6"/>' +
      '<path d="M4.9 3.6h2.8M12.7 3.6h2.8"/>' +
      '<path d="M10.5 12.9v2.4a4.6 4.6 0 0 0 9.2 0v-1.9"/>' + DOT,
    patient:
      '<circle cx="12" cy="7.6" r="3.4"/>' +
      '<path d="M5.4 20.2a6.6 6.6 0 0 1 13.2 0"/>',
    caregiver:
      '<path d="M12 20.4s-7.4-4.2-7.4-9.1A4.1 4.1 0 0 1 12 8.7a4.1 4.1 0 0 1 7.4 2.6c0 4.9-7.4 9.1-7.4 9.1Z"/>',
    vitals:
      '<path d="M3.4 12.4h3.9l1.8-4.4 3 9 2.2-5.2 1.4 2.6h4.5"/>',
    bp:
      '<circle cx="12" cy="12" r="8.2"/>' +
      '<path d="M12 12l4-3.4"/>' + DOT,
    sleep:
      '<path d="M20.2 14.6A8.4 8.4 0 0 1 9.4 3.8a8.4 8.4 0 1 0 10.8 10.8Z"/>',
    steps:
      '<path d="M8.6 4.4c1.9 0 2.9 1.5 2.9 3.3 0 1.5-.7 2.4-1.6 3.3-.7.7-1.1 1.4-1.1 2.3"/>' +
      '<circle class="si-dot" cx="8.6" cy="16.4" r="1.7"/>' +
      '<path d="M16.6 7.6c1.9 0 2.9 1.5 2.9 3.3 0 1.5-.7 2.4-1.6 3.3-.7.7-1.1 1.4-1.1 2.3"/>' +
      '<circle cx="16.6" cy="19.6" r="1.7"/>',
    adherence:
      '<rect x="3.1" y="8.6" width="17.8" height="6.8" rx="3.4" transform="rotate(-45 12 12)"/>' +
      '<path d="M8.4 8.4 15.6 15.6"/>' +
      '<path d="M16.9 3.9l1.4 1.4 2.3-2.3"/>',
    calendar:
      '<rect x="3.8" y="5.4" width="16.4" height="15" rx="2.2"/>' +
      '<path d="M3.8 10h16.4M8.4 3.4v4M15.6 3.4v4"/>' + DOT,
    advice:
      '<path d="M9.2 18.4h5.6M10 21h4"/>' +
      '<path d="M12 3.2a6 6 0 0 0-3.6 10.8c.6.5.9 1.1.9 1.8v.4h5.4v-.4c0-.7.3-1.3.9-1.8A6 6 0 0 0 12 3.2Z"/>' + DOT,
    sos:
      '<path d="M12 3.4 21.4 20H2.6L12 3.4Z"/>' +
      '<path d="M12 9.6v4.2"/>' + DOT,
    certificate:
      '<circle cx="12" cy="9.4" r="5.6"/>' +
      '<path d="M8.4 14.2 7.2 21l4.8-2.5 4.8 2.5-1.2-6.8"/>',
  };
  /* ---- communication and toolbar actions --------------------------------- */
  Object.assign(P, {
    phone:
      '<path d="M8 3.9 10.2 8l-2 1.9a11.6 11.6 0 0 0 5.9 5.9l1.9-2 4.1 2.2v2.4a1.8 1.8 0 0 1-2 1.8C10.4 20 4 13.6 3.8 5.9a1.8 1.8 0 0 1 1.8-2H8Z"/>',
    mail:
      '<rect x="3.2" y="5.4" width="17.6" height="13.2" rx="2.2"/>' +
      '<path d="m3.8 7 8.2 5.6L20.2 7"/>',
    mic:
      '<rect x="9.2" y="3.2" width="5.6" height="10.4" rx="2.8"/>' +
      '<path d="M5.8 11.4a6.2 6.2 0 0 0 12.4 0"/>' +
      '<path d="M12 17.6v3.2"/>',
    speaker:
      '<path d="M4.4 9.4h3.2l4-3.4v12l-4-3.4H4.4Z"/>' +
      '<path d="M15.2 9.2a4 4 0 0 1 0 5.6"/>' +
      '<path d="M17.9 6.5a7.7 7.7 0 0 1 0 11"/>',
    print:
      '<path d="M7 8.4V3.6h10v4.8"/>' +
      '<rect x="3.6" y="8.4" width="16.8" height="7.8" rx="2"/>' +
      '<path d="M7 14.4h10v6H7Z"/>' + DOT,
    save:
      '<path d="M4.4 6.6a2.2 2.2 0 0 1 2.2-2.2h9l4 4v9a2.2 2.2 0 0 1-2.2 2.2H6.6a2.2 2.2 0 0 1-2.2-2.2Z"/>' +
      '<path d="M8 4.4v5h6.4v-5M7.6 19.6v-5.4h8.8v5.4"/>',
    theme:
      '<path d="M20.4 14.2A8.6 8.6 0 0 1 9.8 3.6a8.6 8.6 0 1 0 10.6 10.6Z"/>' +
      '<circle class="si-dot" cx="17.6" cy="6.4" r="1.3"/>',
    passkey:
      '<circle cx="8.4" cy="8.4" r="4.4"/>' +
      '<path d="M11.6 11.6 20 20"/>' +
      '<path d="M16.6 17.4h2.2M17.7 19.5v2.2"/>',
    team:
      '<circle cx="9" cy="8.4" r="3.2"/>' +
      '<circle cx="16.6" cy="9.6" r="2.6"/>' +
      '<path d="M3.4 19.6a5.6 5.6 0 0 1 11.2 0"/>' +
      '<path d="M15 14.9a4.6 4.6 0 0 1 5.6 4.7"/>',
    broadcast:
      '<path d="M4 10.2v3.6h3.4L14 18.6V5.4L7.4 10.2Z"/>' +
      '<path d="M17.2 9.2a4 4 0 0 1 0 5.6"/>' +
      '<path d="M19.6 6.6a7.6 7.6 0 0 1 0 10.8"/>',
    audit:
      '<path d="M6 3.4h8.4L19 8v12.6H6Z"/>' +
      '<path d="M14.2 3.4V8H19"/>' +
      '<path d="M9 12.6h6M9 16h4"/>',
    archive:
      '<rect x="3.4" y="4.4" width="17.2" height="4.4" rx="1.4"/>' +
      '<path d="M5 8.8v9.4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.8"/>' +
      '<path d="M10 12.6h4"/>',
    sync:
      '<path d="M20.2 12a8.2 8.2 0 0 1-13.9 5.9L3.8 15.4"/>' +
      '<path d="M3.8 12a8.2 8.2 0 0 1 13.9-5.9l2.5 2.5"/>' +
      '<path d="M20.2 4.4v4.2H16M3.8 19.6v-4.2H8"/>',
    offline:
      '<path d="M8.4 3.6v5.2M15.6 3.6v5.2"/>' +
      '<path d="M5.6 6.4h12.8v3.2H5.6Z"/>' +
      '<path d="M12 9.6v8.8"/>',
    clock:
      '<circle cx="12" cy="12" r="8.2"/>' +
      '<path d="M12 7.2V12l3.2 2"/>',
    lock:
      '<rect x="4.8" y="10.4" width="14.4" height="10" rx="2.2"/>' +
      '<path d="M8.2 10.4V7.6a3.8 3.8 0 0 1 7.6 0v2.8"/>' + DOT,
    video:
      '<rect x="3" y="6.4" width="12.4" height="11.2" rx="2.2"/>' +
      '<path d="m15.4 11 5.6-3v8l-5.6-3Z"/>',
    inbox:
      '<path d="M3.4 13.4 6 5.2h12l2.6 8.2v5.2a1.8 1.8 0 0 1-1.8 1.8H5.2a1.8 1.8 0 0 1-1.8-1.8Z"/>' +
      '<path d="M3.4 13.4h4.8l1.2 2.6h5.2l1.2-2.6h4.8"/>',
    bulb:
      '<path d="M9.4 18.4h5.2M10.2 21h3.6"/>' +
      '<path d="M12 3.4a6.2 6.2 0 0 0-3.6 11c.6.5.9 1.1.9 1.8v.2h5.4v-.2c0-.7.3-1.3.9-1.8A6.2 6.2 0 0 0 12 3.4Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m4.6 12.6 4.8 4.8 10-10.8"/>',
    menu: '<path d="M4 7.2h16M4 12h16M4 16.8h16"/>',
    back: '<path d="M14.6 5.4 8 12l6.6 6.6"/>',
    close: '<path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8"/>'
  });

  global.App = global.App || {};
  App.iconPaths = P;