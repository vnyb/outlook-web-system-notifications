---
name: pre-review-audit
description: Use before declaring a change done, before a commit the owner will review, or when preparing the extension for the IT team. Audits privacy, permissions, MV3 correctness and code hygiene against the project's hard rules.
---

# Pre-review audit

Run each check, then report a short table (check / OK or issue / file:line). Fix issues only if the owner agrees, except trivial ones.

## 1. Manifest
```bash
python3 -m json.tool manifest.json > /dev/null && echo "manifest JSON OK"
grep -nE '"(permissions|optional_permissions|host_permissions|matches)"' -A6 manifest.json
```
- `manifest_version` is 3; `background.service_worker` set; no `background.page`/`persistent`.
- Permissions ⊆ {`notifications`, `storage`} plus any extra explicitly justified in README "Permissions".
- Hosts/matches ⊆ the three Outlook domains. No `<all_urls>`, `*://*/*`, `http://`.
- No `content_security_policy` loosening (`unsafe-eval`, remote sources). No `web_accessible_resources` unless justified.

## 2. No network, no remote/dynamic code (shipped code only, exclude `diagnostic/` and `test/`)
```bash
grep -rnE 'fetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|importScripts|eval\(|new Function|https?://' src/ manifest.json *.html 2>/dev/null
grep -rnE 'innerHTML|outerHTML\s*=|insertAdjacentHTML|document\.write' src/
```
Every hit must be justified (e.g. an Outlook host pattern in `manifest.json`, `outerHTML` read in debug logging). No `node_modules`, no minified/vendored files.

## 3. MV3 service worker correctness (`src/background.js`)
- All `chrome.*.addListener` calls at top level, synchronous.
- No reliance on module-level state across events; dedup + notification→tab map in `chrome.storage.session`, size-capped.
- Notification click handles a closed tab/window without throwing.

## 4. Detection isolation
- Outlook selectors / text patterns appear only in `src/detector.js` (grep `content.js` and `background.js` for `querySelector`, `role=`, `aria-`).
- No hashed CSS class names used as selectors.
- Debug logging gated behind the debug flag.

## 5. Docs
- README up to date: install, test, permissions with justification, known limitations, DOM-change procedure.
- `manifest.json` `version` bumped if behavior changed.
- State plainly what still needs manual verification in real Outlook.
