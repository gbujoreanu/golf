import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("mobile uses a contained vertical scorecard for the selected round length", async () => {
  const [html, script, styles] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("group-scorecard.js", root), "utf8"),
    readFile(new URL("group-scorecard.css", root), "utf8")
  ]);

  assert.match(html, /data-scorecard-table/);
  assert.match(html, /data-scorecard-cue/);
  assert.doesNotMatch(html, /data-current-hole|data-prev-hole|data-next-hole/);
  assert.match(script, /for\(let i=1;i<=holeCount\(\);i\+\+\)/);
  assert.doesNotMatch(script, /renderMobile|stepButton/);
  assert.match(script, /function mobileScorecard\(\)/);
  assert.match(script, /holeCount\(\)===18/);
  assert.match(script, /\['Nine holes',0,9\]/);
  assert.match(styles, /\.group-score-shell\{[^}]*overflow:hidden/);
  assert.match(styles, /\.mobile-vertical-scorecard/);
});

test("scorecard keeps round totals and accessible score entry", async () => {
  const [html, script] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("group-scorecard.js", root), "utf8")
  ]);

  assert.match(html, /data-scorecard-summary/);
  assert.match(script, /\['F9','front'\],\['B9','back'\],\['Total','total'\],\['To par','par'\]/);
  assert.match(script, /\['9 holes','front'\],\['Total','total'\],\['To par','par'\]/);
  assert.match(script, /input\.setAttribute\('aria-label'/);
  assert.match(script, /input\.inputMode='numeric'/);
  assert.match(script, /savePlayerScorecard/);
  assert.match(script, /data-complete-round/);
});

test("completed shared rounds refresh the normal history and statistics state", async () => {
  const [scorecardScript, appScript] = await Promise.all([
    readFile(new URL("group-scorecard.js", root), "utf8"),
    readFile(new URL("app.js", root), "utf8")
  ]);

  assert.match(scorecardScript, /completeGroupRound\(client,round\.id\)/);
  assert.match(scorecardScript, /fairway:personal-history-updated/);
  assert.match(appScript, /addEventListener\('fairway:personal-history-updated'/);
  assert.match(appScript, /state = await loadCloudState\(\)/);
  assert.match(appScript, /renderAll\(\)/);
});
