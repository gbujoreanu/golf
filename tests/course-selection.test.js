import test from 'node:test';
import assert from 'node:assert/strict';
import { apiSelectionToSavedCourse, ensureSavedApiCourse } from '../course-selection.js';

const selection={course:{id:'course-1',name:'Harbor Links',retrievedAt:'2026-09-19T00:00:00Z'},tee:{key:'blue-male',name:'Blue',label:'Blue · Male',par:72,rating:72.1,slope:131,sourcePar:72,sourceRating:72.1}};

test('maps one selected API tee into the existing private course shape',()=>{
  const {course_snapshot,...legacy}=apiSelectionToSavedCourse(selection);
  assert.deepEqual(legacy,{id:'ogapi-course-1-blue-male',course:'Harbor Links',tee:'Blue · Male',par:72,rating:72.1,slope:131});
  assert.equal(course_snapshot.provider,'opengolfapi');
});

test('explicit re-selection refreshes selected tee provenance without touching round history',async()=>{
  let writes=0;
  const existing=apiSelectionToSavedCourse(selection);
  const client={from(){return{upsert:async()=>{writes+=1;return{error:null}}}}};
  assert.deepEqual(await ensureSavedApiCourse(client,'user-a',[existing],selection),existing);
  assert.equal(writes,1);
});

test('saves only the selected tee for the signed-in user',async()=>{
  let saved=null;
  const client={from(table){assert.equal(table,'golf_courses');return{upsert:async(row,options)=>{saved={row,options};return{error:null}}}}};
  const result=await ensureSavedApiCourse(client,'user-a',[],selection);
  assert.equal(saved.row.user_id,'user-a');
  assert.equal(saved.row.id,result.id);
  assert.deepEqual(saved.options,{onConflict:'user_id,id'});
});
