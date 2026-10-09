# Outlook Reminder Diagnostic (dev only)

Throwaway extension used once to discover the DOM structure of Outlook web's in-page
reminder pop-up. Not part of the shipped extension.

- `diagnostic.js` (isolated world): watches DOM changes and logs every element that looks
  like a reminder (`role="dialog"|"alertdialog"|"alert"|"status"`, `aria-live`, `aria-modal`,
  or text / `aria-label` containing reminder words or `OWN-TEST`), with its `outerHTML`,
  `role` / `aria-*` / `data-*` attributes and ancestor chain.
- `notification-spy.js` (page world): logs any call Outlook makes to `new Notification()` or
  `registration.showNotification()`, then forwards it unchanged. Confirms whether Outlook
  ever tries to use system notifications.

No permissions, no network, no storage. Everything is printed to the DevTools console
with the `[OWN-DIAG]` prefix.

## Load it

1. Open `chrome://extensions`, enable **Developer mode** (top right).
2. **Load unpacked** → select this `diagnostic/` folder.
3. Reload the Outlook tab (or the Outlook PWA window).
4. Open DevTools (`F12`, or `Ctrl+Shift+I`; in the PWA: ⋮ menu → *More tools* → *Developer tools*).
   Console filter: `OWN-DIAG`. You should see `[OWN-DIAG] diagnostic active (top)`.

## Create a test event

1. In Outlook calendar, **New event**, title **`OWN-TEST`**.
2. Type the start time by hand (the field accepts any minute, not only the proposed slots):
   **now + 7 minutes** (e.g. it is 10:00 → start 10:07).
3. **Reminder**: **5 minutes before** → it fires about 2 minutes from now. Save.
4. Keep the Outlook window **visible and in the foreground** until the pop-up appears.
5. Expand the `[OWN-DIAG]` groups that contain the pop-up text.

To also look for other titles: in the console (page context) run
`localStorage.OWN_DIAG_TITLES = "Title A|Title B"`, then reload.

## Export the result

- Either expand an entry, right-click the `outerHTML:` string → **Copy string contents**;
- or pick the **"Outlook Reminder Diagnostic"** context in the console's context dropdown
  (top-left, default "top"), then run `copy(JSON.stringify(OWN_DIAG.entries, null, 2))`.

**Anonymize before sharing**: real titles, names, e-mail addresses, meeting URLs (Teams
links contain tokens), phone numbers. Keep the structure, attributes and generic texts
("dans 2 minutes", "Ignorer", "Rejoindre"…) intact.

## Remove it

`chrome://extensions` → *Outlook Reminder Diagnostic* → **Remove** once the samples are collected.
