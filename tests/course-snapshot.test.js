import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHoleData,selectedCourseSnapshot,snapshotForRound} from '../course-snapshot.js';
import {normalizeCourseDetail,normalizeTees,OpenGolfApiProvider} from '../open-golf-api.js';

function selection(count=18){
  const course=normalizeCourseDetail({id:'synthetic-course',name:'Test Links',holes:count,par:count===9?36:72,
    scorecard:Array.from({length:count},(_,i)=>({hole:i+1,par:4,yardage:400}))});
  course.retrievedAt='2026-09-19T00:00:00.000Z';
  const [tee]=normalizeTees({tees:[{tee_key:'test-white',tee_name:'White',par:count===9?36:72,
    course_rating:count===9?35:70,slope:120,yardage:count===9?3200:6400,
    holes:[{hole:1,par:5,yards:510,handicap:2}]}]},course);
  return {course,tee};
}

test('captures exact raw provider values and validated tee-specific holes',()=>{
  const s=selectedCourseSnapshot(selection());
  assert.equal(s.provider,'opengolfapi'); assert.equal(s.course.id,'synthetic-course');
  assert.equal(s.tee.id,'test-white'); assert.equal(s.tee.yardage,6400);
  assert.deepEqual(s.holes[0],{number:1,par:5,yardage:510,stroke_index:2});
  assert.deepEqual(s.holes[1],{number:2,par:4,yardage:null,stroke_index:null});
  assert.equal(s.course_holes[1].yardage,400);
});
test('nine-hole source values are preserved, not doubled like legacy calculation inputs',()=>{
  const selected=selection(9),s=selectedCourseSnapshot(selected);
  assert.equal(selected.tee.rating,70); assert.equal(s.tee.rating,35);
  assert.equal(s.tee.par,36); assert.equal(s.holes.length,9);
  assert.equal(snapshotForRound(s,18).holes.length,9); // Never invent a second nine.
});
test('9/18 individual round snapshots retain source data and isolate later mutation',()=>{
  const selected=selection(),source=selectedCourseSnapshot(selected);
  const nine=snapshotForRound(source,9),eighteen=snapshotForRound(source,18);
  source.holes[0].par=8; selected.course.name='Changed';
  assert.equal(nine.round_hole_count,9); assert.equal(eighteen.round_hole_count,18);
  assert.equal(nine.holes[0].par,5); assert.equal(eighteen.course.name,'Test Links');
  assert.equal(nine.holes.length,18); // round_hole_count identifies played first nine.
});
test('incomplete, invalid, duplicate and ambiguous holes never fabricate values',()=>{
  assert.deepEqual(normalizeHoleData([{hole:1,par:4},{hole:1,par:5},{hole:2,par:99,yards:-4},
    {hole:3,par:null},{hole:4,par:true},{hole:0,par:4}]),[
      {number:2,par:null,yardage:null,stroke_index:null},
      {number:3,par:null,yardage:null,stroke_index:null},
      {number:4,par:null,yardage:null,stroke_index:null}]);
  assert.equal(snapshotForRound(null,18),null);
  assert.throws(()=>snapshotForRound({},10));
});
test('retrieval time remains the original time on cached details',async()=>{
  const provider=new OpenGolfApiProvider({fetcher:async url=>({ok:true,json:async()=>url.endsWith('/tees')
    ? {tees:[{tee_key:'a',tee_name:'White',par:72,course_rating:70,slope:120}]}
    : {id:'c',name:'Test Course',holes:18,par:72}})});
  const first=await provider.getCourseOptions('c'),second=await provider.getCourseOptions('c');
  assert.match(first.course.retrievedAt,/Z$/); assert.equal(first.course.retrievedAt,second.course.retrievedAt);
});
