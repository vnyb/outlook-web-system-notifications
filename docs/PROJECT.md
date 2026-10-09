# Project: Chrome extension that converts Outlook web in-page calendar notifications into system notifications

> Source of truth for the project's goals and constraints. Do not modify without
> the owner's agreement; record decisions and progress in `CLAUDE.md` instead.

## Context

Outlook web (Microsoft 365, enterprise SSO login) is used in Chrome, either in a regular tab or as an installed PWA (https://outlook.cloud.microsoft/calendar).

## The problem

When a calendar event reaches its reminder time, Outlook web does produce a notification, but it is an **in-page web pop-up** (a toast/popup rendered inside the page DOM), not a **system (desktop) notification**. If the Outlook window is minimized, in the background, or on another workspace, the user doesn't see it and misses the meeting.

What has already been verified:
- System notifications work in the browser: running `new Notification("Test", {...})` in the console of the Outlook page displays a real system notification.
- Notifications are allowed for the site and enabled in Outlook's settings.
- The problem is therefore specific to Outlook's calendar reminders, which are rendered as in-page pop-ups and never go through the system notification API.

## Requirement

Develop a **Chrome extension (Manifest V3)** that **detects the in-page calendar notification pop-up in Outlook web and produces a system notification from it**, containing at least: the event title, the start time and, if available, the location or meeting link.

The extension must be **environment-agnostic**: it relies only on standard Chrome extension APIs, with no OS-specific code or assumptions.

### Expected behavior

1. The extension works in an Outlook tab **and** in the installed Outlook PWA window (to be verified: extensions normally inject into Chrome PWAs).
2. A content script observes the DOM (MutationObserver) to spot the reminder pop-up when it appears, and extracts the title, time, and any other available information.
3. It sends this information to the service worker, which displays the system notification (`chrome.notifications`, or `registration.showNotification` if more reliable).
4. Clicking the system notification brings the Outlook window or tab to the foreground.
5. **No duplicates**: a given reminder must trigger only one system notification, even if Outlook re-renders or updates the pop-up. Use a deduplication key (for example title + start time) kept in memory for the session.
6. Optionally: a sound or higher priority for imminent reminders, and a simple options page (enable/disable, sound).

## Important constraints

- **Do not use Microsoft Graph, EWS, or any API requiring admin consent or an OAuth app of the extension's own.** The organization may block third-party applications. The extension must only read what the page already displays.
- **Privacy**: all data stays in the browser. No outgoing network calls, no telemetry, no remote code, no libraries loaded from a CDN.
- **Minimal permissions**: `notifications` and a `host_permissions` / `matches` limited to Outlook domains (`https://outlook.cloud.microsoft/*`, and as a precaution `https://outlook.office.com/*`, `https://outlook.office365.com/*`). No `<all_urls>`, no `tabs` or `history` unless justified.
- Simple, readable, commented code with no unnecessary dependencies (vanilla JS, or TypeScript without a heavy framework). The code will be reviewed by me, and possibly by my IT team.
- Outlook's DOM changes often: isolate the detection logic in a single module, with several fallback strategies (ARIA attributes, `role="dialog"` or `role="alert"`, text such as "Rappel"/"Reminder"), and provide a debug mode that logs what is detected to the console.

## First step requested

I don't know the exact DOM structure of the in-page pop-up. Before writing the final code:

1. Write a diagnostic content script that logs to the console all DOM changes that look like a reminder pop-up (text containing "rappel", "reminder", "minutes", or an event title), with the element's `outerHTML` and its `role`/`aria-*` attributes.
2. Tell me how to load it (`chrome://extensions` > developer mode > "Load unpacked") and how to create a test event with a reminder in 2 minutes. The reminder must appear while the Outlook window is visible, since that is the case that fails.
3. I will paste the HTML actually observed (with sensitive data anonymized), then you will write the final detection.

## Deliverables

- Project structure: `manifest.json`, `content.js`, `background.js` (service worker), `options.html` if useful, icons.
- Short README: developer-mode installation, testing, known limitations, what to do when Outlook changes its DOM.
- A list of manual test cases: simple reminder, several simultaneous reminders, already-seen reminder, minimized window, background tab.
