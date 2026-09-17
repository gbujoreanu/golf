import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,stat } from 'node:fs/promises';
import { normalizeScorecard,playerCountLayout,scorecardColumns,SCORECARD_BACKDROPS,scorecardFilename,scorecardHighlights } from '../scorecard-export-v3.js';

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

test('uses intentional layouts for one through four golfers',()=>{
  const layouts=[1,2,3,4].map(playerCountLayout);
  assert.deepEqual(layouts.map(layout=>layout.mode),['poster','head-to-head','three-player','compact']);
  assert.ok(layouts[0].rowHeight>layouts[1].rowHeight&&layouts[1].rowHeight>layouts[2].rowHeight&&layouts[2].rowHeight>layouts[3].rowHeight);
  assert.ok(layouts[0].panelHeight<layouts[1].panelHeight&&layouts[1].panelHeight<layouts[2].panelHeight&&layouts[2].panelHeight<layouts[3].panelHeight);
  layouts.forEach(layout=>assert.equal(layout.highlightsY-layout.tableBottom,22));
});

test('offers five distinct premium backdrop assets',()=>{
  assert.equal(SCORECARD_BACKDROPS.length,5);
  assert.equal(new Set(SCORECARD_BACKDROPS.map(item=>item.id)).size,5);
  assert.equal(new Set(SCORECARD_BACKDROPS.map(item=>item.url)).size,5);
});

test('places the front-nine total between the two 18-hole groups',()=>{
  const labels=scorecardColumns(18,924,154,190).map(cell=>cell.label);
  assert.deepEqual(labels,['1','2','3','4','5','6','7','8','9','F9','10','11','12','13','14','15','16','17','18','B9','TOTAL','+/−']);
});

test('keeps the 9-hole export free of back-nine structure',()=>{
  const labels=scorecardColumns(9,924,210,240).map(cell=>cell.label);
  assert.deepEqual(labels,['1','2','3','4','5','6','7','8','9','9','TOTAL','+/−']);
  assert.equal(labels.includes('F9'),false);assert.equal(labels.includes('B9'),false);
});

test('completed individual and shared views expose export without new data access',async()=>{
  const root=new URL('../',import.meta.url);const [app,group,index,renderer,styles,groupStyles,exportStyles,...assets]=await Promise.all([
    readFile(new URL('app.js',root),'utf8'),readFile(new URL('group-scorecard.js',root),'utf8'),readFile(new URL('index.html',root),'utf8'),readFile(new URL('scorecard-export-v3.js',root),'utf8'),readFile(new URL('style.css',root),'utf8'),readFile(new URL('group-scorecard.css',root),'utf8'),readFile(new URL('scorecard-export.css',root),'utf8'),...SCORECARD_BACKDROPS.map(item=>stat(new URL(item.url)))
  ]);
  assert.match(app,/data-export-round/);assert.match(app,/openScorecardExportPicker/);assert.match(app,/scorecard-export-v3\.js\?v=1/);
  assert.match(group,/round\.status!==\'completed\'/);assert.match(group,/data-export-scorecard/);
  assert.match(group,/scorecard-export-v3\.js\?v=1/);
  assert.match(index,/data-export-scorecard hidden/);assert.match(index,/scorecard-export\.css\?v=1/);assert.match(index,/app\.js\?v=21/);assert.match(index,/group-scorecard\.js\?v=9/);
  assert.match(styles,/\.history-export\{[^}]*min-height:42px/);assert.match(styles,/@media\(max-width:480px\)[^\n]*\.history-export\{flex:1\}/);
  assert.match(groupStyles,/\.scorecard-heading-actions \.button\{min-height:44px\}/);assert.match(groupStyles,/grid-template-columns:1fr 1fr/);
  assert.match(exportStyles,/\.scorecard-backdrop-picker/);assert.match(exportStyles,/@media\(max-width:430px\)/);
  assert.doesNotMatch(renderer,/supabase|client\.(?:from|rpc)\(/i);assets.forEach(asset=>assert.ok(asset.size>100000));
});
