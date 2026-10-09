// SPDX-License-Identifier: EUPL-1.2
// Copyright (c) 2026 Vianney Bajart
/*
 * Service worker: turns reminders reported by the content script into system notifications.
 *
 * MV3 constraints that shape this file:
 * - The worker is stopped after ~30 s idle, so no state is kept in variables between events.
 *   Session state lives in chrome.storage.session (in memory, cleared when the browser quits).
 * - Listeners are registered synchronously at top level, so Chrome can wake the worker for them.
 *
 * Session state:
 *   seen:    { [dedupKey]: timestampMs }                           — reminders already notified
 *   targets: { [notificationId]: { tabId, windowId, at } }          — where to go on click
 * Entries are pruned after 24 h, not on notification close: on some systems a notification
 * "closes" when it moves to the notification center, where it can still be clicked.
 */
"use strict";

const DEFAULT_SETTINGS = { enabled: true, keepImminent: true, debug: false };

/** A reminder starting within this many minutes (or already started) is "imminent". */
const IMMINENT_MINUTES = 5;

/** Session entries older than this are dropped, to keep storage small. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const MAX_FIELD_LENGTH = 300;

/** Used when the reporting tab was closed before the notification was clicked. */
const FALLBACK_URL = "https://outlook.cloud.microsoft/calendar";

// ---------------------------------------------------------------------------
// Listeners (top level, synchronous)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Only our own content scripts, running in a tab, can report reminders.
  if (msg?.type !== "own:reminder" || sender.id !== chrome.runtime.id || !sender.tab) return false;

  serialize(() => handleReminder(msg.reminder, sender.tab))
    .then(sendResponse)
    .catch((e) => sendResponse({ shown: false, error: String(e) }));
  return true; // answer asynchronously
});

chrome.notifications.onClicked.addListener((notificationId) => {
  serialize(() => focusSource(notificationId));
});

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Run storage read-modify-write sequences one at a time, so two tabs reporting the same
 * reminder simultaneously cannot both pass the dedup check.
 */
let queue = Promise.resolve();
function serialize(task) {
  const run = queue.then(task);
  queue = run.catch(() => {}); // a failed task must not block the next ones
  return run;
}

/** Keep only a non-empty string, clamped. */
function text(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, MAX_FIELD_LENGTH) : "";
}

/** Drop entries older than MAX_AGE_MS from a { key: {at}|number } map. */
function prune(map, now) {
  for (const [k, v] of Object.entries(map)) {
    const at = typeof v === "number" ? v : v?.at;
    if (!at || now - at > MAX_AGE_MS) delete map[k];
  }
  return map;
}

/**
 * Minutes from now until a start time shown as "11:34", "9h30", "2:00 PM"…
 * Outlook shows no date, so the closest occurrence (±12 h) is assumed.
 * @returns {number|null} negative if already started, null if unparseable
 */
function minutesUntil(start, now = new Date()) {
  const m = /(\d{1,2})[:.h](\d{2})\s?([ap])?/i.exec(start);
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  const meridiem = m[3]?.toLowerCase();
  if (meridiem === "p" && hours < 12) hours += 12;
  if (meridiem === "a" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;

  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  let diff = (target - now) / 60000;
  if (diff > 12 * 60) diff -= 24 * 60;
  if (diff < -12 * 60) diff += 24 * 60;
  return Math.round(diff);
}

async function handleReminder(raw, tab) {
  const reminder = {
    key: text(raw?.key),
    title: text(raw?.title),
    start: text(raw?.start),
    location: text(raw?.location),
    status: text(raw?.status),
  };
  if (!reminder.key || !reminder.title) return { shown: false, reason: "invalid" };

  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
  if (!settings.enabled) return { shown: false, reason: "disabled" };

  const now = Date.now();
  const { seen = {}, targets = {} } = await chrome.storage.session.get(["seen", "targets"]);
  prune(seen, now);
  prune(targets, now);

  if (seen[reminder.key]) return { shown: false, reason: "duplicate" };

  const minutes = minutesUntil(reminder.start);
  const imminent = minutes !== null && minutes <= IMMINENT_MINUTES;

  // The dedup key is a valid notification id, and makes a re-creation update instead of stacking.
  const notificationId = reminder.key;
  await chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
    title: reminder.title,
    message: [reminder.start, reminder.location].filter(Boolean).join(" · ") || chrome.i18n.getMessage("notificationFallback"),
    contextMessage: reminder.status || "Outlook",
    priority: imminent ? 2 : 0,
    requireInteraction: imminent && settings.keepImminent,
  });

  seen[reminder.key] = now;
  targets[notificationId] = { tabId: tab.id, windowId: tab.windowId, at: now };
  await chrome.storage.session.set({ seen, targets });

  if (settings.debug) console.log("[OWN] notification shown", reminder, { minutes, imminent });
  return { shown: true, imminent };
}

/** Bring the Outlook window and tab that reported the reminder to the foreground. */
async function focusSource(notificationId) {
  const { targets = {} } = await chrome.storage.session.get("targets");
  const target = targets[notificationId];
  chrome.notifications.clear(notificationId);

  try {
    if (!target) throw new Error("unknown target");
    // Neither call needs the "tabs" permission. The OS window manager may still refuse
    // to raise the window (focus-stealing prevention); then it is usually highlighted instead.
    await chrome.windows.update(target.windowId, { focused: true });
    await chrome.tabs.update(target.tabId, { active: true });
  } catch {
    // Tab or window closed meanwhile: open Outlook calendar instead.
    await chrome.tabs.create({ url: FALLBACK_URL });
  }
}
