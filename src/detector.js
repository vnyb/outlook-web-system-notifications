/*
 * Outlook reminder detector — the ONLY file that knows Outlook web's DOM.
 *
 * When Outlook changes its markup, this is the file to update (see README,
 * "When Outlook changes its DOM"). It reads the page, never modifies it.
 *
 * Observed structure (2026-10-09, fixture 2026-10-09-fr-single-teams-reminder.html):
 *
 *   div[data-app-section="NotificationPane"][aria-live="polite"]      ← the reminder pane
 *     … header text "Rappels" / "Reminders", button#remindersDismissAllButtonId
 *     div#reminderContainer-<ExchangeItemId>                         ← one per reminder
 *       button#reminderButton-<id>[title="<subject>\n<time> <location>"]
 *         … leaf divs: <subject> <time> <location> <status, e.g. "Maintenant">
 *       div#reminderHoverActionsId-<id> > buttons (join Teams, snooze, dismiss)
 *
 * CSS classes (e.g. "QOYVK", "pqihW") are generated and change with every Outlook
 * release: they are deliberately never used.
 *
 * Exposes globalThis.OWN.detectReminders(root) → Array<Reminder>, where Reminder is
 *   { key, title, start, location, status, strategy }.
 */
"use strict";

(() => {
  const CONFIG = {
    // Strategy "ids" — 2026-10-09, 2026-10-09-fr-single-teams-reminder.html
    itemContainerSelector: '[id^="reminderContainer-"]',
    itemContainerIdPrefix: "reminderContainer-",
    itemButtonSelector: '[id^="reminderButton-"]',

    // Strategy "pane" — 2026-10-09, same fixture
    paneSelector: '[data-app-section="NotificationPane"]',

    // Strategy "aria-text" — generic fallback, any pop-up-like container…
    ariaContainerSelector:
      '[aria-live],[role="dialog"],[role="alertdialog"],[role="alert"],[role="region"],[role="complementary"]',
    // …whose header is exactly this word (plural: the event form shows a singular "Rappel" label)…
    paneHeaderPattern: /^(rappels|reminders)$/,
    // …and which contains a dismiss control (aria-label or text). Accents are stripped before matching.
    dismissPattern: /disparaitre|ignorer|dismiss/,

    // Start time as Outlook shows it: "11:34", "9h30", "2:00 PM", "14.30".
    // The AM/PM suffix must not be followed by a letter ("11:34 Amphi" is not "11:34 AM").
    timePattern: /\b\d{1,2}[:.h]\d{2}(?:\s?[ap]\.?m\.?(?![a-zà-ÿ]))?(?!\d)/i,

    // Avoid pathological input (texts are clamped before being sent to the service worker).
    maxTextLength: 300,
  };

  /** Collapse whitespace and trim. */
  function clean(s) {
    return (s || "").replace(/\s+/g, " ").trim().slice(0, CONFIG.maxTextLength);
  }

  /** Lowercase without accents, for keyword matching ("Faire disparaître" → "faire disparaitre"). */
  function fold(s) {
    return clean(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  /** Visible texts of the element's leaf elements, in document order (icons excluded). */
  function leafTexts(el) {
    const out = [];
    for (const n of el.querySelectorAll("*")) {
      if (n.closest("svg")) continue;
      if (n.children.length === 0) {
        const t = clean(n.textContent);
        if (t) out.push(t);
      }
    }
    return out;
  }

  /**
   * Extract the fields of one reminder from its main button.
   * Primary source: the `title` attribute ("<subject>\n<time> <location>").
   * Fallback: the leaf texts ([subject, time, location?, status?]).
   * @returns {{title:string,start:string,location:string,status:string}|null}
   */
  function extractFromButton(button) {
    const leaves = leafTexts(button);
    const lines = (button.getAttribute("title") || "").split(/\r?\n/).map(clean).filter(Boolean);

    let title = "";
    let start = "";
    let location = "";

    if (lines.length >= 2) {
      title = lines[0];
      const m = CONFIG.timePattern.exec(lines[1]);
      if (m) {
        start = clean(m[0]);
        location = clean(lines[1].slice(m.index + m[0].length));
      }
    }

    // Fallback (or complement) from leaf texts.
    const timeIndex = leaves.findIndex((t) => CONFIG.timePattern.test(t) && t.length <= 12);
    if (!title && timeIndex > 0) title = leaves[0];
    if (!start && timeIndex > 0) {
      start = leaves[timeIndex];
      // The leaf right after the time is the location, unless it is the last one (the status).
      if (timeIndex + 1 < leaves.length - 1) location = leaves[timeIndex + 1];
    }

    // Status ("Maintenant", "Dans 5 minutes"…): last leaf, if it is none of the other fields.
    const last = leaves[leaves.length - 1] || "";
    const status = leaves.length >= 3 && ![title, start, location].includes(last) ? last : "";

    if (!title || !start) return null;
    return { title, start, location, status };
  }

  /** Dedup key when Outlook gives no stable id. */
  function textKey(r) {
    return `text:${fold(r.title)}|${fold(r.start)}`;
  }

  /** True if the container holds a "dismiss" control (aria-label or text). */
  function hasDismissControl(container) {
    for (const b of container.querySelectorAll("button,[role='button']")) {
      if (CONFIG.dismissPattern.test(fold(b.getAttribute("aria-label") || b.textContent))) return true;
    }
    return false;
  }

  /** Reminder-looking buttons inside a pane: buttons from which a title and a time can be extracted. */
  function remindersFromButtons(container, strategy) {
    const out = [];
    for (const b of container.querySelectorAll("button")) {
      const r = extractFromButton(b);
      if (r) out.push({ ...r, key: textKey(r), strategy });
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Strategies, tried in order; the first one that finds something wins.
  // ---------------------------------------------------------------------------

  /** 1. Outlook's own element ids, which embed the Exchange item id (best dedup key). */
  function byIds(root) {
    const out = [];
    for (const container of root.querySelectorAll(CONFIG.itemContainerSelector)) {
      const button = container.querySelector(CONFIG.itemButtonSelector) || container.querySelector("button");
      if (!button) continue;
      const r = extractFromButton(button);
      if (!r) continue;
      const itemId = container.id.slice(CONFIG.itemContainerIdPrefix.length);
      // The start time is part of the key in case Outlook reuses the id for recurring occurrences.
      out.push({ ...r, key: `id:${itemId}|${fold(r.start)}`, strategy: "ids" });
    }
    return out;
  }

  /** 2. The pane's data-app-section attribute, items found by content. */
  function byPane(root) {
    const out = [];
    for (const pane of root.querySelectorAll(CONFIG.paneSelector)) out.push(...remindersFromButtons(pane, "pane"));
    return out;
  }

  /** 3. Any ARIA live/dialog container titled "Rappels"/"Reminders" with a dismiss control. */
  function byAriaText(root) {
    const out = [];
    for (const c of root.querySelectorAll(CONFIG.ariaContainerSelector)) {
      const header = leafTexts(c)[0];
      if (!header || !CONFIG.paneHeaderPattern.test(fold(header))) continue;
      if (!hasDismissControl(c)) continue;
      out.push(...remindersFromButtons(c, "aria-text"));
    }
    return out;
  }

  const STRATEGIES = [byIds, byPane, byAriaText];

  /**
   * Find the reminders currently displayed under `root`.
   * @param {Document|Element} root
   * @returns {Array<{key:string,title:string,start:string,location:string,status:string,strategy:string}>}
   */
  function detectReminders(root) {
    for (const strategy of STRATEGIES) {
      const found = strategy(root);
      if (found.length) {
        // Same reminder found twice (nested matches): keep the first.
        const unique = new Map();
        for (const r of found) if (!unique.has(r.key)) unique.set(r.key, r);
        return [...unique.values()];
      }
    }
    return [];
  }

  globalThis.OWN = Object.assign(globalThis.OWN || {}, { detectReminders, CONFIG });
})();
