import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("Fairway friend actions have an intentional hierarchy", async () => {
  const [script, styles, html] = await Promise.all([
    readFile(new URL("social.js", root), "utf8"),
    readFile(new URL("social.css", root), "utf8"),
    readFile(new URL("index.html", root), "utf8")
  ]);

  const plan = script.indexOf("action('Plan round','plan-round',person,'primary')");
  const follow = script.indexOf("(person.is_following?secondary:actions).append");
  assert.ok(plan >= 0 && plan < follow, "Plan round should lead the friend action row");
  assert.match(styles, /\.social-action\{[^}]*background:var\(--surface-panel\)/);
  assert.match(styles, /data-social-action="remove-friend"/);
  assert.match(styles, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(script, /secondary.append\(action\('Remove friend'/);
  assert.match(script, /dialog.showModal\(\)/);
  assert.match(html, /social\.css\?v=4/);
  assert.match(html, /social\.js\?v=5/);
});
