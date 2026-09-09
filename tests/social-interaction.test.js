import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=(await readFile(new URL('../social.js',import.meta.url),'utf8')).replace(/import[\s\S]*?from '[^']+';/g,'');
function harness(){
  const context=vm.createContext({window:{},document:{querySelector:()=>null},console});
  vm.runInContext(source,context);
  vm.runInContext('setMessage=()=>{};render=()=>{};',context);
  return context;
}

test('Cancelled destructive action preserves the row and enables the next tap',async()=>{
  const context=harness();let calls=0;
  context.confirmAction=async()=>false;
  context.removeFriend=async()=>calls++;
  context.button={dataset:{socialAction:'remove-friend',userId:'synthetic'},disabled:false};
  await vm.runInContext("handleClick({target:{closest:s=>s==='[data-social-action]'?button:null}})",context);
  assert.equal(calls,0);
  assert.equal(context.button.disabled,false);
  assert.equal(vm.runInContext('actionPending',context),false);
});

test('Failed mutation restores button so mobile users can retry',async()=>{
  const context=harness();
  context.setFollow=async()=>{throw Error('offline')};context.socialError=()=> 'Try again';
  context.button={dataset:{socialAction:'follow',userId:'synthetic'},disabled:false,setAttribute(){},removeAttribute(){}};
  await vm.runInContext("handleClick({target:{closest:s=>s==='[data-social-action]'?button:null}})",context);
  assert.equal(context.button.disabled,false);
  assert.equal(vm.runInContext('actionPending',context),false);
});

test('Repeated taps cannot submit concurrent relationship mutations',async()=>{
  const context=harness();let calls=0,finish;
  context.setFollow=()=>{calls++;return new Promise(resolve=>finish=resolve)};
  context.loadActive=async()=>{};
  context.button={dataset:{socialAction:'follow',userId:'synthetic'},disabled:false,setAttribute(){},removeAttribute(){}};
  const first=vm.runInContext("handleClick({target:{closest:s=>s==='[data-social-action]'?button:null}})",context);
  await vm.runInContext("handleClick({target:{closest:s=>s==='[data-social-action]'?button:null}})",context);
  assert.equal(calls,1);finish();await first;
  assert.equal(context.button.disabled,false);
});

for(const [action,helper,expected] of [
  ['follow','setFollow',['synthetic',true]],['unfollow','setFollow',['synthetic',false]],
  ['friend','requestFriend',['synthetic']],['cancel-request','cancelFriendRequest',['request']],
  ['accept','respondFriend',['request','accepted']],['decline','respondFriend',['request','declined']],
  ['remove-friend','removeFriend',['synthetic']],['block','blockUser',['synthetic']]
])test(`${action} keeps the existing relationship API contract`,async()=>{
  const context=harness();let args;
  context[helper]=async(_client,...rest)=>{args=rest};
  context.confirmAction=async()=>true;context.loadActive=async()=>{};
  context.button={dataset:{socialAction:action,userId:'synthetic',requestId:'request'},disabled:false,setAttribute(){},removeAttribute(){}};
  await vm.runInContext("handleClick({target:{closest:s=>s==='[data-social-action]'?button:null}})",context);
  assert.deepEqual(args,expected);assert.equal(context.button.disabled,false);
});
