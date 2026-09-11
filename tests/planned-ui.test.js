import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("Upcoming rounds use a readable tee-sheet hierarchy", async () => {
  const [script, styles, html] = await Promise.all([
    readFile(new URL("planned.js", root), "utf8"),
    readFile(new URL("planned.css", root), "utf8"),
    readFile(new URL("index.html", root), "utf8")
  ]);

  assert.match(script, /const hosted=confirmed\.filter\(round=>round\.is_host\)/);
  assert.match(script, /const joining=confirmed\.filter\(round=>!round\.is_host\)/);
  assert.match(script, /renderUpcomingBoard\(root\.querySelector\('\[data-upcoming-list\]'\),hosted,joining\)/);
  assert.match(script, /fact\('Tee time'/);
  assert.match(script, /fact\('Round'/);
  assert.match(script, /statusLabel\(round,context\)/);
  assert.match(script, /roundMenu\(round,/);
  assert.match(styles, /\.upcoming-groups\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.tee-actions>\.button\{[^}]*min-height:44px/);
  assert.match(styles, /@media\(max-width:980px\)\{\.upcoming-groups\{grid-template-columns:1fr/);
  assert.match(styles, /@media\(max-width:480px\)[\s\S]*\.tee-more-panel\{position:fixed/);
  assert.match(html, /data-invite-count/);
  assert.match(html, /data-upcoming-count/);
  assert.match(html, /planned\.css\?v=3/);
  assert.match(html, /planned\.js\?v=5/);
});
