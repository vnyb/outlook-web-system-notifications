// SPDX-License-Identifier: EUPL-1.2
// Copyright (c) 2026 Vianney Bajart
/*
 * Runs OWN.detectReminders on every fixture listed in fixtures/fixtures.json and compares the
 * result with the "<!-- expected: [...] -->" comment on the fixture's first line.
 * Dev-only: fetches local fixture files, never the network.
 */
"use strict";

const FIELDS = ["title", "start", "location", "status"];

function line(cls, text) {
  const div = document.createElement("div");
  div.className = cls;
  div.textContent = text;
  document.getElementById("results").append(div);
}

async function runFixture(name) {
  const html = await (await fetch(`fixtures/${name}`)).text();
  const m = /<!--\s*expected:\s*(\[[\s\S]*?\])\s*-->/.exec(html);
  if (!m) throw new Error("missing <!-- expected: [...] --> comment");
  const expected = JSON.parse(m[1]);

  const doc = new DOMParser().parseFromString(html, "text/html");
  const actual = globalThis.OWN.detectReminders(doc);

  const errors = [];
  if (actual.length !== expected.length) errors.push(`expected ${expected.length} reminder(s), got ${actual.length}`);
  expected.forEach((exp, i) => {
    for (const f of FIELDS) {
      if (f in exp && actual[i]?.[f] !== exp[f]) errors.push(`#${i} ${f}: expected "${exp[f]}", got "${actual[i]?.[f]}"`);
    }
  });
  const keys = actual.map((r) => r.key);
  if (new Set(keys).size !== keys.length) errors.push("duplicate keys");
  return { errors, actual };
}

(async () => {
  const names = await (await fetch("fixtures/fixtures.json")).json();
  let failed = 0;
  for (const name of names) {
    try {
      const { errors, actual } = await runFixture(name);
      const strategies = [...new Set(actual.map((r) => r.strategy))].join(",") || "-";
      if (errors.length) {
        failed++;
        line("fail", `FAIL ${name}: ${errors.join("; ")}`);
      } else {
        line("pass", `PASS ${name} (${actual.length} reminder(s), strategy: ${strategies})`);
      }
      const pre = document.createElement("pre");
      pre.textContent = JSON.stringify(actual, null, 2);
      document.getElementById("results").append(pre);
    } catch (e) {
      failed++;
      line("fail", `ERROR ${name}: ${e.message}`);
    }
  }
  const summary = failed ? `FAILED: ${failed}/${names.length}` : `ALL PASSED: ${names.length}/${names.length}`;
  document.getElementById("summary").textContent = summary;
  document.title = summary;
})();
