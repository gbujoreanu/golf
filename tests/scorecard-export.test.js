import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,stat } from 'node:fs/promises';
import { normalizeScorecard,scorecardFilename,scorecardHighlights } from '../scorecard-export.js';

const nine={course:'Nine & Dine',date:'2026-09-10',tee:'Gold',holeCount:9,par:36,participants:[{name:'Alex',holes:[4,5,3,4,4,5,3,4,4]}]};
const eighteen={course:'Seaside Dunes',date:'2026-09-10',tee:'Blue',holeCount:18,par:72,participants:[{name:'Alex',holes:[4,5,3,4,4,4,3,5,4,4,4,4,3,4,5,3,5,4]}]};

test('normalizes 9-hole and 18-hole individual scorecards',()=>{
  const short=normalizeScorecard(nine),full=normalizeScorecard(eighteen);
  assert.deepEqual([short.participants[0].front,short.participants[0].back,short.participants[0].total,short.participants[0].toPar],[36,null,36,'E']);
  assert.deepEqual([full.participants[0].front,full.participants[0].back,full.participants[0].total,full.participants[0].toPar],[36,36,72,'E']);
  assert.deepEqual(scorecardHighlights(nine),[['Nine holes','36'],['Total','36'],['To par','E']]);
  assert.deepEqual(scorecardHighlights(eighteen),[['Front 9','36'],['Back 9','36'],['Total','72'],['To par','E']]);
});

test('derives supported 18-hole group highlights from score data',()=>{
  const card={...eighteen,participants:[
    {name:'Alex',holes:[4,5,3,4,4,4,3,5,4,4,4,4,3,4,5,3,5,4]},
    {name:'Mason',holes:[5,5,3,4,5,5,3,4,4,4,4,5,2,4,4,4,5,4]},
    {name:'Jordan',holes:[4,6,3,4,4,5,4,4,5,4,5,5,3,4,4,3,6,4]}
  ]};
  assert.deepEqual(scorecardHighlights(card),[
    ['Winner','Alex · 72'],['Best Front 9','Alex · 36'],['Best Back 9','Alex & Mason · 36'],['Closest Match','Alex & Mason · 2 strokes']
  ]);
});

test('adapts 9-hole group highlights without a back-nine claim',()=>{
  const card={...nine,participants:[{name:'Alex',holes:nine.participants[0].holes},{name:'Mason',holes:[5,5,3,4,5,5,3,4,4]}]};
  assert.deepEqual(scorecardHighlights(card),[['Winner','Alex'],['Winning score','36 (E)'],['Closest Match','Alex & Mason · 2 strokes']]);
});

test('creates a safe stable PNG filename',()=>{
  assert.equal(scorecardFilename({...nine,course:'Pine Ridge / North'}),'fairway-pine-ridge-north-2026-09-10.png');
});

test('completed individual and shared views expose export without new data access',async()=>{
  const root=new URL('../',import.meta.url);const [app,group,index,renderer,styles,groupStyles,asset]=await Promise.all([
    readFile(new URL('app.js',root),'utf8'),readFile(new URL('group-scorecard.js',root),'utf8'),readFile(new URL('index.html',root),'utf8'),readFile(new URL('scorecard-export.js',root),'utf8'),readFile(new URL('style.css',root),'utf8'),readFile(new URL('group-scorecard.css',root),'utf8'),stat(new URL('assets/fairway-share-bg.png',root))
  ]);
  assert.match(app,/data-export-round/);assert.match(app,/downloadScorecardPng/);
  assert.match(group,/round\.status!==\'completed\'/);assert.match(group,/data-export-scorecard/);
  assert.match(index,/data-export-scorecard hidden/);assert.match(index,/app\.js\?v=17/);assert.match(index,/group-scorecard\.js\?v=5/);
  assert.match(styles,/\.history-export\{[^}]*min-height:42px/);assert.match(styles,/@media\(max-width:480px\)[^\n]*\.history-export\{flex:1\}/);
  assert.match(groupStyles,/\.scorecard-heading-actions \.button\{min-height:44px\}/);assert.match(groupStyles,/grid-template-columns:1fr 1fr/);
  assert.doesNotMatch(renderer,/supabase|client\.(?:from|rpc)\(/i);assert.ok(asset.size>100000);
});
