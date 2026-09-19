import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenGolfApiProvider, normalizeCourseSearch, normalizeCourseDetail, normalizeTees } from '../open-golf-api.js';
import { LatestRequestGate } from '../course-picker.js';

const searchPayload={courses:[
  {id:'a',course_name:'Pine Hills',city:'Albany',state:'NY',par:72},
  {id:'b',name:'Pine Valley',location:{city:'Clementon',state:'NJ'},par:70}
]};

test('normalizes partial-name search results with location context',()=>{
  assert.deepEqual(normalizeCourseSearch(searchPayload).map(({id,name,location})=>({id,name,location})),[
    {id:'a',name:'Pine Hills',location:'Albany, NY'},
    {id:'b',name:'Pine Valley',location:'Clementon, NJ'}
  ]);
});

test('normalizes tee choices and converts nine-hole ratings for current Fairway calculations',()=>{
  const course=normalizeCourseDetail({id:'nine',name:'Short Course',holes:9,par:36},'nine');
  const tees=normalizeTees({tees:[{tee_key:'white-m',tee_name:'White',gender:'Male',course_rating:35.6,slope:118,par:36,yardage:3100}]},course);
  assert.deepEqual(tees,[{key:'white-m',name:'White',gender:'Male',label:'White · Male',par:72,rating:71.2,slope:118,yardage:3100}]);
});

test('provider uses encoded search, caches repeated queries, and loads tee details',async()=>{
  const calls=[];
  const fetcher=async url=>{
    calls.push(url);
    if(url.endsWith('/tees'))return response({tees:[{tee_key:'blue',tee_name:'Blue',course_rating:71.4,slope:128,par:72}]});
    if(url.includes('/courses/search'))return response(searchPayload);
    return response({id:'a',name:'Pine Hills',city:'Albany',state:'NY',holes:18,par:72});
  };
  const provider=new OpenGolfApiProvider({fetcher});
  const first=await provider.searchCourses('pine hills');
  const second=await provider.searchCourses('PINE HILLS');
  const details=await provider.getCourseOptions(first[0].id);
  assert.equal(calls.filter(url=>url.includes('/search')).length,1);
  assert.match(calls[0],/q=pine%20hills/);
  assert.equal(second[0].name,'Pine Hills');
  assert.equal(details.tees[0].label,'Blue');
});

test('latest request gate rejects stale responses',()=>{
  const gate=new LatestRequestGate();
  const older=gate.next();
  const newer=gate.next();
  assert.equal(gate.isCurrent(older),false);
  assert.equal(gate.isCurrent(newer),true);
});

function response(payload){return{ok:true,status:200,json:async()=>payload}}

