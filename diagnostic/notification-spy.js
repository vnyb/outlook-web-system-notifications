// SPDX-License-Identifier: EUPL-1.2
// Copyright (c) 2026 Vianney Bajart
/*
 * Outlook Reminder Diagnostic — page-world spy (runs in the page's MAIN world).
 *
 * Purpose: confirm whether Outlook ever calls the system notification APIs
 * (`new Notification(...)` or `ServiceWorkerRegistration.showNotification(...)`).
 * Each call is logged with the "[OWN-DIAG] Notification API" prefix and then
 * forwarded unchanged to the original API: page behavior is not altered.
 *
 * Throwaway diagnostic only — the shipped extension never runs code in the page world.
 */
"use strict";

(() => {
  const PREFIX = "[OWN-DIAG] Notification API";

  if (typeof window.Notification === "function") {
    const Original = window.Notification;
    console.info(`${PREFIX}: permission = ${Original.permission}`);

    // Subclass so `instanceof`, static members (permission, requestPermission) keep working.
    class SpyNotification extends Original {
      constructor(title, options) {
        console.warn(`${PREFIX}: new Notification() called`, { title, options });
        super(title, options);
      }
    }
    window.Notification = SpyNotification;

    const originalRequest = Original.requestPermission.bind(Original);
    SpyNotification.requestPermission = (...args) => {
      console.warn(`${PREFIX}: requestPermission() called`);
      return originalRequest(...args);
    };
  }

  if (window.ServiceWorkerRegistration && ServiceWorkerRegistration.prototype.showNotification) {
    const originalShow = ServiceWorkerRegistration.prototype.showNotification;
    ServiceWorkerRegistration.prototype.showNotification = function (title, options) {
      console.warn(`${PREFIX}: registration.showNotification() called`, { title, options });
      return originalShow.call(this, title, options);
    };
  }
})();
