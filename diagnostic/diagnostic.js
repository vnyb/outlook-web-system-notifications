// SPDX-License-Identifier: EUPL-1.2
// Copyright (c) 2026 Vianney Bajart
/*
 * Outlook Reminder Diagnostic — content script (isolated world).
 *
 * Purpose: discover what Outlook's in-page reminder pop-up looks like in the DOM.
 * It watches DOM changes and logs, with the "[OWN-DIAG]" prefix, every element
 * that looks like a reminder: ARIA dialog/alert/live regions, or text/aria-label
 * containing reminder-like words or the test event title.
 *
 * Throwaway tool: read-only, never modifies the page, no network, no storage.
 * All logged entries are also kept in `OWN_DIAG.entries` (see diagnostic/README.md).
 */
"use strict";

(() => {
  /** Words that suggest a reminder (FR + EN), compared without accents, lowercase. */
  const KEYWORDS = [
    "rappel", "reminder",
    "minute", // "dans 5 minutes", "in 5 minutes", "1 minute"
    "maintenant", "now",
    "en retard", "overdue", "en cours", "in progress",
    "ignorer", "dismiss", "repeter", "snooze",
    "rejoindre", "join",
    "own-test", // recommended title of the test event (see README)
  ];

  /** Optional extra titles to look for: localStorage.OWN_DIAG_TITLES = "Title 1|Title 2" */
  try {
    const extra = localStorage.getItem("OWN_DIAG_TITLES");
    if (extra) KEYWORDS.push(...extra.split("|").map(normalize).filter(Boolean));
  } catch { /* storage may be unavailable; ignore */ }

  /** Roles / attributes that mark a pop-up-like container. */
  const CONTAINER_SELECTOR =
    '[role="dialog"],[role="alertdialog"],[role="alert"],[role="status"],[aria-live],[aria-modal="true"]';

  /** Above this text length an element is a page chunk, not a pop-up: we look inside it instead. */
  const MAX_CONTAINER_TEXT = 2000;
  const MAX_HTML_LOGGED = 30000;
  const MAX_TEXT_NODES_PER_ROOT = 200;

  const frameLabel = window === window.top ? "top" : `iframe ${location.href}`;
  const entries = [];
  const seen = new Set(); // signatures already logged (avoids repeated logs on re-render)
  globalThis.OWN_DIAG = { entries, keywords: KEYWORDS };

  /** Lowercase and strip accents so "Répéter" matches "repeter". */
  function normalize(s) {
    return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }

  /** Keywords must start a word ("now" matches "now", not "unknown"). */
  function matchedKeywords(text) {
    const t = normalize(text);
    if (!t) return [];
    return KEYWORDS.filter((k) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(k)}`).test(t));
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /** role + every aria-* and data-* attribute of an element, as a plain object. */
  function interestingAttributes(el) {
    const out = {};
    for (const a of el.attributes) {
      if (a.name === "role" || a.name.startsWith("aria-") || a.name.startsWith("data-") ||
          a.name === "id" || a.name === "hidden" || a.name === "open") {
        out[a.name] = a.value;
      }
    }
    return out;
  }

  /** Short description of the ancestor chain, to understand where the pop-up is mounted. */
  function ancestry(el) {
    const chain = [];
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const role = n.getAttribute("role");
      const label = n.getAttribute("aria-label");
      const dataAttrs = [...n.attributes].filter((a) => a.name.startsWith("data-")).map((a) => a.name);
      chain.push(
        n.tagName.toLowerCase() +
          (n.id ? `#${n.id}` : "") +
          (role ? `[role=${role}]` : "") +
          (label ? `[aria-label="${label.slice(0, 60)}"]` : "") +
          (dataAttrs.length ? `{${dataAttrs.join(",")}}` : "")
      );
    }
    return chain.join(" < ");
  }

  /**
   * From an element that matched, climb to the most plausible pop-up container:
   * the closest ARIA dialog/alert/live ancestor, else the highest ancestor
   * (max 8 levels) whose text stays short.
   */
  function findContainer(el) {
    const aria = el.closest(CONTAINER_SELECTOR);
    if (aria && (aria.textContent || "").length <= MAX_CONTAINER_TEXT * 2) return aria;
    let best = el;
    for (let n = el.parentElement, i = 0; n && n !== document.body && i < 8; n = n.parentElement, i++) {
      if ((n.textContent || "").length > MAX_CONTAINER_TEXT) break;
      best = n;
    }
    return best;
  }

  /** Collect candidate containers inside a mutated root (the root itself may be huge). */
  function collectCandidates(root, reasons) {
    const found = new Map(); // container -> reason

    // 1. ARIA containers in or around the root.
    const ariaEls = [];
    if (root.matches(CONTAINER_SELECTOR)) ariaEls.push(root);
    ariaEls.push(...root.querySelectorAll(CONTAINER_SELECTOR));
    for (const el of ariaEls) {
      // Empty live regions are common and useless; skip them.
      if ((el.textContent || "").trim() || el.querySelector("button")) found.set(el, `aria (${reasons})`);
    }

    // 2. aria-label attributes containing keywords.
    const labelled = root.matches("[aria-label]") ? [root] : [];
    labelled.push(...root.querySelectorAll("[aria-label]"));
    for (const el of labelled) {
      const kw = matchedKeywords(el.getAttribute("aria-label"));
      if (kw.length) found.set(findContainer(el), `aria-label: ${kw.join(", ")} (${reasons})`);
    }

    // 3. Text nodes containing keywords.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let count = 0;
    for (let t = walker.nextNode(); t && count < MAX_TEXT_NODES_PER_ROOT; t = walker.nextNode()) {
      if (!t.nodeValue.trim()) continue;
      count++;
      const kw = matchedKeywords(t.nodeValue);
      if (kw.length && t.parentElement) {
        found.set(findContainer(t.parentElement), `text: ${kw.join(", ")} (${reasons})`);
      }
    }
    return found;
  }

  function log(container, reason) {
    const text = (container.textContent || "").replace(/\s+/g, " ").trim();
    const html = container.outerHTML;
    const signature = container.tagName + "|" + text.slice(0, 500);
    if (seen.has(signature)) return;
    seen.add(signature);

    const entry = {
      time: new Date().toISOString(),
      frame: frameLabel,
      visibility: document.visibilityState,
      hasFocus: document.hasFocus(),
      reason,
      tag: container.tagName.toLowerCase(),
      attributes: interestingAttributes(container),
      text: text.slice(0, 1000),
      ancestry: ancestry(container),
      outerHTML: html.length > MAX_HTML_LOGGED ? html.slice(0, MAX_HTML_LOGGED) + "…[truncated]" : html,
    };
    entries.push(entry);

    console.groupCollapsed(`[OWN-DIAG] #${entries.length} ${entry.tag} — ${reason} — "${entry.text.slice(0, 80)}"`);
    console.log("time / frame / visibility / focus:", entry.time, entry.frame, entry.visibility, entry.hasFocus);
    console.log("attributes (role, aria-*, data-*):", entry.attributes);
    console.log("text:", entry.text);
    console.log("ancestry:", entry.ancestry);
    console.log("element (hover to highlight):", container);
    console.log("outerHTML:", entry.outerHTML);
    console.groupEnd();
  }

  // Mutations arrive in bursts (React re-renders): batch them and process after a short delay.
  let pending = new Map(); // element -> reason
  let timer = null;

  function schedule(el, reason) {
    if (!(el instanceof Element)) return;
    if (!pending.has(el)) pending.set(el, reason);
    if (!timer) timer = setTimeout(flush, 300);
  }

  function flush() {
    timer = null;
    const batch = pending;
    pending = new Map();
    for (const [root, reason] of batch) {
      if (!root.isConnected) continue; // already removed again, nothing to inspect
      try {
        for (const [container, why] of collectCandidates(root, reason)) log(container, why);
      } catch (e) {
        console.warn("[OWN-DIAG] error while inspecting", root, e);
      }
    }
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "childList") {
        for (const n of m.addedNodes) {
          if (n.nodeType === Node.ELEMENT_NODE) schedule(n, "added");
          else if (n.nodeType === Node.TEXT_NODE) schedule(n.parentElement, "text added");
        }
      } else if (m.type === "characterData") {
        schedule(m.target.parentElement, "text changed");
      } else if (m.type === "attributes") {
        schedule(m.target, `attribute ${m.attributeName} changed`);
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    // Only attributes that could reveal/hide a pop-up, to limit noise.
    attributeFilter: ["role", "aria-hidden", "aria-label", "aria-live", "aria-modal", "hidden", "open"],
  });

  // A reminder may already be displayed when the page loads (e.g. overdue reminders).
  setTimeout(() => schedule(document.body, "initial scan"), 3000);

  console.info(
    `[OWN-DIAG] diagnostic active (${frameLabel}). Keywords:`, KEYWORDS,
    "\nLogged entries: select this extension's context in the console dropdown, then run copy(JSON.stringify(OWN_DIAG.entries, null, 2))"
  );
})();
