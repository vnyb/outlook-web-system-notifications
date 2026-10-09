// SPDX-License-Identifier: EUPL-1.2
// Copyright (c) 2026 Vianney Bajart
/*
 * Options page: three checkboxes saved in chrome.storage.local (stays on this device,
 * never synced). Defaults must match DEFAULT_SETTINGS in background.js.
 */
"use strict";

const DEFAULT_SETTINGS = { enabled: true, keepImminent: true, debug: false };

// Localized labels (textContent only).
for (const el of document.querySelectorAll("[data-i18n]")) {
  el.textContent = chrome.i18n.getMessage(el.dataset.i18n);
}

const status = document.getElementById("status");

chrome.storage.local.get(DEFAULT_SETTINGS).then((settings) => {
  for (const name of Object.keys(DEFAULT_SETTINGS)) {
    const box = document.getElementById(name);
    box.checked = settings[name];
    box.addEventListener("change", async () => {
      await chrome.storage.local.set({ [name]: box.checked });
      status.textContent = chrome.i18n.getMessage("optionsSaved");
      setTimeout(() => { status.textContent = ""; }, 1500);
    });
  }
});
