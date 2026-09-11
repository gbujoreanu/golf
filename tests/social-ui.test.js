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
  assert.match(styles, /\.golfer-row::before\{/);
  assert.match(styles, /\.golfer-states span\+span::before\{content:"\/"/);
  assert.match(styles, /\.golfer-actions \.social-action,\.golfer-more>summary\{[^}]*min-height:46px/);
  assert.match(styles, /\.social-action\.primary\{[^}]*background:var\(--accent\)/);
  assert.match(styles, /@media\(max-width:520px\)[\s\S]*\.golfer-secondary\{position:fixed/);
  assert.match(script, /secondary.append\(action\('Remove friend'/);
  assert.match(script, /dialog.showModal\(\)/);
  assert.match(html, /social\.css\?v=5/);
  assert.match(html, /social\.js\?v=7/);
});
