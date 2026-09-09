import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("mobile uses the same contained 18-hole scorecard as desktop", async () => {
  const [html, script, styles] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("group-scorecard.js", root), "utf8"),
    readFile(new URL("group-scorecard.css", root), "utf8")
  ]);

  assert.match(html, /data-scorecard-table/);
  assert.match(html, /Swipe or scroll across all 18 holes/);
  assert.doesNotMatch(html, /data-current-hole|data-prev-hole|data-next-hole/);
  assert.match(script, /for\(let i=1;i<=18;i\+\+\)/);
  assert.doesNotMatch(script, /renderMobile|stepButton/);
  assert.match(styles, /\.group-score-shell\{[^}]*overflow:hidden/);
  assert.match(styles, /\.group-score-table-wrap\{[^}]*overflow-x:auto/);
  assert.doesNotMatch(styles, /\.group-score-table-wrap\{[^}]*display:none/);
});

test("scorecard keeps round totals and accessible score entry", async () => {
  const [html, script] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("group-scorecard.js", root), "utf8")
  ]);

  assert.match(html, /data-scorecard-summary/);
  assert.match(script, /\['F9','front'\],\['B9','back'\],\['Total','total'\],\['To par','par'\]/);
  assert.match(script, /input\.setAttribute\('aria-label'/);
  assert.match(script, /input\.inputMode='numeric'/);
  assert.match(script, /savePlayerScorecard/);
  assert.match(script, /data-complete-round/);
});
