import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHoleCount,summarizeScores,teeSnapshotForLength} from '../round-lengths.js';

const tee={par:72,rating:71.4,slope:128};

test('round length defaults safely to 18 holes',()=>{
  assert.equal(normalizeHoleCount(undefined),18);
  assert.equal(normalizeHoleCount(12),18);
  assert.equal(normalizeHoleCount('9'),9);
});

test('9-hole totals and score to par use only nine played holes',()=>{
  const result=summarizeScores(Array(9).fill(4),tee,9);
  assert.deepEqual(teeSnapshotForLength(tee,9),{par:36,rating:35.7,slope:128});
  assert.equal(result.front,36);
  assert.equal(result.back,null);
  assert.equal(result.total,36);
  assert.equal(result.toPar,'E');
  assert.equal(result.complete,true);
});

test('18-hole totals preserve front, back, and completion behavior',()=>{
  const result=summarizeScores([...Array(9).fill(4),...Array(9).fill(5)],tee,18);
  assert.equal(result.front,36);
  assert.equal(result.back,45);
  assert.equal(result.total,81);
  assert.equal(result.toPar,'+9');
  assert.equal(result.complete,true);
});

test('a 9-hole card does not require holes 10 through 18',()=>{
  assert.equal(summarizeScores(Array(9).fill(4),tee,9).complete,true);
  assert.equal(summarizeScores(Array(9).fill(4),tee,18).complete,false);
});
