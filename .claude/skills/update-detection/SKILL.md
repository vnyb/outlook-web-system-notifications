---
name: update-detection
description: Use when the owner pastes HTML of an Outlook reminder pop-up (from the diagnostic script or the debug log), or reports that reminders are no longer detected because Outlook changed its DOM. Turns the sample into a fixture and updates src/detector.js safely.
---

# Update reminder detection from a real Outlook sample

## 1. Check the sample is anonymized
Scan the pasted HTML for real names, e-mail addresses, Teams/meeting URLs with tokens, phone numbers, tenant ids. If any remain, replace them with obvious placeholders (`Jane Doe`, `user@example.com`, `https://teams.example/meet/XXXX`) **and tell the owner** what you replaced. Never commit unanonymized data.

## 2. Save it as a fixture
- File: `test/fixtures/YYYY-MM-DD-<lang>-<context>-<short-desc>.html` (e.g. `2026-10-09-fr-pwa-single-reminder.html`).
- First line: an HTML comment with date, UI language, tab or PWA, and the expected extraction:
  `<!-- expected: [{"title":"Weekly sync","start":"10:00","location":"Teams"}] -->`
- Keep the surrounding container (dialog/alert ancestor), not just the inner text.
- Add the filename to `test/fixtures/fixtures.json`.

## 3. Analyze before coding
List, for the owner, the stable hooks found: `role`, `aria-*`, `data-*` attributes, element structure, visible text. Flag which ones look generated/hashed (do not use them). Note whether several reminders appear in one container (list) or separate containers.

## 4. Update `src/detector.js`
- Change only `CONFIG` and/or add/adjust **one** strategy; keep existing fallback strategies.
- Add a comment next to each new selector: date + fixture filename.
- Keep the `detectReminders(root)` return shape unchanged.

## 5. Verify
- Open (or ask the owner to open) `test/detector-test.html`: all fixtures, old and new, must pass.
- Record the confirmed facts in CLAUDE.md → "Observed Outlook DOM".
- If the README "When Outlook changes its DOM" section is now inaccurate, update it.
- Give the owner the manual test cases to re-run in real Outlook.
