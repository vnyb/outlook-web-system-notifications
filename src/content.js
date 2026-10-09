/*
 * Content script: watches the Outlook page and forwards each NEW reminder to the
 * service worker, which shows the system notification.
 *
 * - Knows nothing about Outlook's DOM: detection is delegated to detector.js (loaded first).
 * - First dedup layer (per tab): a reminder is sent once, however often Outlook re-renders it.
 *   The service worker dedups again across tabs (Outlook tab + PWA window).
 * - Read-only: never modifies the page.
 */
"use strict";

(() => {
  const { detectReminders } = globalThis.OWN;

  /** Minimum delay between two scans; mutations arrive in bursts while Outlook renders. */
  const SCAN_INTERVAL_MS = 250;

  /** Keys already sent from this tab. */
  const sent = new Set();

  let debug = false;
  let lastScan = 0;
  let trailingTimer = null;

  function log(...args) {
    if (debug) console.log("[OWN]", ...args);
  }

  // Debug mode: options page, or `localStorage.OWN_DEBUG = "1"` in the Outlook console.
  try {
    debug = localStorage.getItem("OWN_DEBUG") === "1";
  } catch { /* storage unavailable: keep default */ }
  chrome.storage.local.get({ debug: false }).then((s) => { debug = debug || s.debug; }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.debug) debug = !!changes.debug.newValue;
  });

  /** Local date "YYYY-MM-DD": a daily recurring meeting is a new reminder each day. */
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  /** Extension reloaded or removed while the page stays open: this script is orphaned. */
  function extensionGone() {
    return !chrome.runtime?.id;
  }

  function scan() {
    lastScan = Date.now();
    if (extensionGone()) {
      observer.disconnect();
      return;
    }

    let reminders;
    try {
      reminders = detectReminders(document);
    } catch (e) {
      log("detection error", e); // never break the Outlook page
      return;
    }

    for (const r of reminders) {
      const key = `${r.key}|${today()}`;
      if (sent.has(key)) continue;
      sent.add(key);
      log(`new reminder (strategy "${r.strategy}")`, r);

      chrome.runtime
        .sendMessage({
          type: "own:reminder",
          reminder: { key, title: r.title, start: r.start, location: r.location, status: r.status },
        })
        .then((res) => log("service worker answer", res))
        .catch((e) => {
          // Not delivered (service worker failed to start…): allow a retry on the next scan.
          sent.delete(key);
          log("send failed, will retry", e);
        });
    }
  }

  /**
   * Throttled scan: runs immediately if the last scan is old enough (so latency does not depend
   * on timers, which Chrome throttles in background tabs), otherwise once at the end of the burst.
   */
  function onMutations() {
    const wait = SCAN_INTERVAL_MS - (Date.now() - lastScan);
    if (wait <= 0) {
      scan();
    } else if (!trailingTimer) {
      trailingTimer = setTimeout(() => {
        trailingTimer = null;
        scan();
      }, wait);
    }
  }

  // The reminder pane is mounted in a portal directly under <body>, and its items are added
  // as children: childList + subtree is enough (verified on 2026-10-09).
  const observer = new MutationObserver(onMutations);
  observer.observe(document.body, { childList: true, subtree: true });

  // Reminders may already be displayed when the page loads (e.g. overdue ones).
  scan();
  log("content script active");
})();
