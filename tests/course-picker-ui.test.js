import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root=new URL('../',import.meta.url);

test('Add Round and Plan Round expose API search, tee selection, and manual fallback',async()=>{
  const [html,app,planned]=await Promise.all([
    readFile(new URL('index.html',root),'utf8'),
    readFile(new URL('app.js',root),'utf8'),
    readFile(new URL('planned.js',root),'utf8')
  ]);
  assert.match(html,/data-course-picker="round"/);
  assert.match(html,/data-course-picker="planned"/);
  assert.equal((html.match(/data-course-query/g)||[]).length,2);
  assert.equal((html.match(/data-course-tee/g)||[]).length,4);
  assert.equal((html.match(/data-manual-course/g)||[]).length,2);
  assert.match(app,/ensureSavedApiCourse/);
  assert.match(planned,/ensureSavedApiCourse/);
  assert.doesNotMatch(planned,/if\(!courses\.length\)\{location\.hash='courses'/);
});

