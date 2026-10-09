# CLAUDE.md — Outlook web → system notifications (Chrome MV3 extension)

Goals, requirements and constraints: @docs/PROJECT.md (read it; it wins over anything below if they conflict).

## Working conventions

- Talk to the owner in **French**. Write code, comments, commit messages, README and docs in **English** (the IT team reviews them).
- Commit only when asked. No push.
- When unsure about real Outlook behavior (DOM, timing, PWA), **ask the owner to test** rather than guess. Never invent selectors.

## Current phase

1. **Diagnostic** (done 2026-10-09): `diagnostic/` holds a throwaway content script that logs reminder-looking DOM changes. It is not shipped.
2. **Final detection** (v1.0.0 written 2026-10-09, awaiting the owner's manual tests in real Outlook): built from the first real sample. New samples go through the `update-detection` skill.
3. **Polish** (open): sound (needs `offscreen`, not approved), snooze re-notification (decision pending), owner feedback.

Update this section when the phase changes, and record confirmed DOM facts under "Observed Outlook DOM" below.

## Target layout

```
manifest.json
src/
  detector.js      # ONLY place that knows Outlook's DOM (selectors, text patterns, extraction)
  content.js       # MutationObserver + per-tab dedup + messaging; no selectors here
  background.js    # service worker: cross-tab dedup, chrome.notifications, click → focus
  options.html / options.js
_locales/en, fr/   # all user-visible strings
icons/             # 16, 32, 48, 128 px PNG
diagnostic/        # phase-1 tool, separate manifest, never mixed with src/
test/
  fixtures/        # anonymized HTML samples (*.html) + fixtures.json (list); "synthetic-*" = hand-made
  detector-test.html  # open in Chrome: runs detector.js against every fixture, no deps
README.md
```

## Hard rules (from the spec — never break them)

- **No network**: no `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `<img src=http…>`, no CDN, no analytics. No Graph/EWS/OAuth.
- **No remote or dynamic code**: no `eval`, `new Function`, `setTimeout("string")`, no script injection into the page.
- **Permissions allowlist**: `notifications`, `storage`. Host matches limited to `https://outlook.cloud.microsoft/*`, `https://outlook.office.com/*`, `https://outlook.office365.com/*`. Anything else (`offscreen` for sound, `tabs`, `alarms`…) requires an explicit justification in the README "Permissions" section and the owner's OK first. Never `<all_urls>`, `scripting`, `history`, `webRequest`.
- **No dependencies, no build step**: vanilla JS (ES2022), loadable as-is via "Load unpacked". No npm packages in the shipped extension.
- **Never write extracted page content with `innerHTML`**; use `textContent`. Treat everything read from the DOM as untrusted.

## Chrome MV3 technical rules

- **Service worker is ephemeral** (killed after ~30 s idle): module-level variables do not survive. Keep the dedup set and the `notificationId → {tabId, windowId}` map in `chrome.storage.session` (in-memory, cleared on browser restart = "for the session"). Cap its size (e.g. drop keys older than 24 h).
- Register all `chrome.*` event listeners **synchronously at top level** of `background.js`, never inside a promise or callback, or wake-up events are lost.
- Dedup in **two layers**: in the content script (cheap, avoids message spam on re-renders) and in the service worker (authoritative, covers the same reminder showing in both a tab and the PWA).
- Dedup key = normalized `title + start time` (trim, collapse whitespace, lowercase). If Outlook offers a stable id in the DOM, prefer it — confirm with fixtures.
- Notification click: use `sender.tab.id` / `sender.tab.windowId` captured at message time, then `chrome.windows.update(windowId, {focused: true})` + `chrome.tabs.update(tabId, {active: true})`. This does **not** need the `tabs` permission. Handle the tab having been closed (catch and ignore).
- `chrome.notifications.create` needs a packaged `iconUrl`. Use `requireInteraction: true` and `priority: 2` for imminent reminders. `chrome.notifications` has no sound option: sound means an offscreen document (`offscreen` permission → needs justification, see above).
- Content scripts are classic scripts in an isolated world: share code between `detector.js` and `content.js` through a single global namespace (`globalThis.OWN = …`), listed in order in `manifest.json` `content_scripts.js`. No ES `import`.
- Keep the MutationObserver cheap: observe `document.body` with `childList: true, subtree: true` (add `attributes`/`characterData` only if fixtures show the pop-up is updated in place), debounce processing (~200 ms), only inspect added nodes and their ancestors up to a dialog/alert container.
- `all_frames`: keep `false` unless the diagnostic proves the pop-up lives in an iframe.
- Background tabs: Chrome throttles timers in hidden tabs (up to 1 min alignment after 5 min hidden). Outlook's own reminder may therefore be late; document it as a known limitation, don't try to work around it with keep-alive hacks.

## Detection module (`src/detector.js`)

- Exposes one pure-ish API: `detectReminders(root) → Array<{key, title, start, location, link, strategy}>`.
- Strategies are an **ordered list**, each small and independent, tried until one yields results:
  1. confirmed selectors from fixtures (data attributes / class-independent structure);
  2. ARIA: `role="dialog" | "alertdialog" | "alert"`, `aria-live`, `aria-label` containing reminder words;
  3. text heuristics: FR/EN words (`rappel`, `reminder`, `dans X minutes`, `in X minutes`, `maintenant`, `now`, `en retard`, `overdue`, `ignorer`, `dismiss`, `répéter`, `snooze`).
- **Never rely on generated CSS class names** (`.ms-xYz123`, hashed classes) — they change on every Outlook release.
- All selectors and word lists live in one `CONFIG` object at the top of the file, commented with the date and fixture they come from.
- Debug mode (option + `localStorage.OWN_DEBUG = "1"` fallback): log `[OWN]`-prefixed messages with the strategy used, the extracted fields and the element. Off by default — logs contain meeting data.
- Every selector change must keep all existing fixtures passing in `test/detector-test.html`.

## Code style

- `"use strict";`, `const`/`let`, small functions, JSDoc on every exported/namespace function.
- Comment the *why* (Outlook quirks, MV3 lifecycle constraints), not the obvious.
- Fail silently in production (catch, optionally log in debug mode); never break the Outlook page.

## Verification before saying "done"

- `python3 -m json.tool manifest.json` passes; manifest has no permission outside the allowlist.
- Run the `pre-review-audit` skill.
- Real behavior can only be checked by the owner in Outlook: give them the exact manual test cases to run (see docs/PROJECT.md deliverables) and say clearly what was not verified.

## Observed Outlook DOM

2026-10-09, French UI, outlook.cloud.microsoft, window visible but not focused (fixture `2026-10-09-fr-single-teams-reminder.html`):

- Outlook never calls `new Notification()` / `showNotification()` for reminders (diagnostic spy: nothing logged; permission was `granted`).
- Top frame, no iframe. Pane mounted in a portal: `body[role=application] > div[data-portal-node] > div[data-app-section="NotificationPane"][aria-live="polite"]`.
- Header text "Rappels" (plural even with one reminder), `button#remindersDismissAllButtonId`, `button#remindersDismissBannerId` ("Fermer").
- One `div#reminderContainer-<ExchangeItemId>` per reminder; `button#reminderButton-<id>` with `title="<subject>\n<HH:MM> <location>"`; leaf divs: subject, time, location, status ("Maintenant").
- Hover actions `div#reminderHoverActionsId-<id>`: join Teams (aria-label, **no URL**), chat, snooze (`id="snooze_NNN"`), `button#dismissButton-<id>`.
- All CSS classes are generated (hashed) — unusable.
- Noise seen by the diagnostic and to avoid: the new-event form has a "Rappel" (singular) drop-down with "5 minutes avant"…; calendar `aria-live` regions ("193 événement(s) chargé(s)…").
- Not yet observed: English UI, PWA window, several reminders, minimized window, status texts other than "Maintenant".
