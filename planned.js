import { listRelationshipPeople, personLabel, socialError } from '/shared/social.js?v=4';
import { renderIdentityAvatar } from '/shared/identity.js?v=3';
import {
  loadPlannedRoundData,createPlannedRound,updatePlannedRound,invitePlayers,
  respondToRound,removePlayer,leaveRound,cancelRound
} from './planned-rounds.js';

const client=window.AppAuth?.client;
const root=document.querySelector('[data-planned-rounds]');
const dialog=document.getElementById('planRoundDialog');
const form=document.getElementById('planRoundForm');
let user=null,rounds=[],courses=[],friends=[],editingId=null,prefillFriendId=null;

if(client&&root){
  root.addEventListener('click',handleAction);
  form.addEventListener('submit',savePlan);
  dialog.querySelectorAll('[data-close-plan]').forEach(control=>control.addEventListener('click',()=>dialog.close()));
  dialog.addEventListener('close',resetForm);
  window.addEventListener('fairway:view',event=>{if(event.detail==='upcoming'&&user)load();});
  window.addEventListener('fairway:plan-round',event=>{prefillFriendId=event.detail?.userId||null;location.hash='upcoming';openPlan();});
  client.auth.onAuthStateChange((_event,session)=>setUser(session?.user||null));
  client.auth.getSession().then(({data})=>setUser(data.session?.user||null));
}

async function setUser(next){if(user?.id===next?.id)return;user=next;if(user)await load()}
async function load(){
  root.setAttribute('aria-busy','true');setMessage('Checking tee times…');
  try{const data=await loadPlannedRoundData(client);rounds=data.rounds;courses=data.courses;friends=await listRelationshipPeople(client,'friends');render();setMessage('')}
  catch(error){console.error(error);setMessage(friendlyError(error),true)}finally{root.removeAttribute('aria-busy')}
}

function render(){
  const invites=rounds.filter(round=>round.status==='planned'&&!round.is_host&&round.viewer_status==='invited');
  const confirmed=rounds.filter(round=>round.status!=='completed'&&(round.is_host||round.viewer_status==='accepted'));
  const completed=rounds.filter(round=>round.status==='completed'&&(round.is_host||round.viewer_status==='accepted'));
  renderList(root.querySelector('[data-round-invites]'),invites,'No pending invitations.');
  renderList(root.querySelector('[data-upcoming-list]'),confirmed,'No upcoming rounds.');
  renderList(root.querySelector('[data-completed-list]'),completed,'No completed shared rounds yet.');
  root.querySelector('[data-plan-round]').disabled=!courses.length;
  root.querySelector('[data-no-courses]').hidden=Boolean(courses.length);
}

function renderList(output,items,emptyCopy){
  output.replaceChildren();
  if(!items.length){const empty=document.createElement('div');empty.className='tee-time-empty';empty.innerHTML=`<strong>${emptyCopy}</strong><span>${emptyCopy.includes('invitations')?'Invitations from Fairway friends will appear here.':'Choose a saved course and invite friends when you are ready.'}</span>`;output.append(empty);return}
  items.forEach(round=>output.append(roundRow(round)));
}

function roundRow(round){
  const article=document.createElement('article');article.className='tee-time-row';article.dataset.roundId=round.id;
  const when=new Date(round.scheduled_at);const date=document.createElement('div');date.className='tee-date';
  date.innerHTML=`<span>${when.toLocaleDateString([], {month:'short'}).toUpperCase()}</span><strong>${when.toLocaleDateString([], {day:'2-digit'})}</strong><small>${when.toLocaleDateString([], {weekday:'short'})}</small>`;
  const body=document.createElement('div');body.className='tee-time-main';
  const title=document.createElement('div');title.className='tee-time-title';
  const heading=document.createElement('h3');heading.textContent=round.course_name;
  const time=document.createElement('p');time.textContent=`${when.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})} · ${round.tee_name} tees`;
  title.append(heading,time);
  const host=document.createElement('p');host.className='tee-host';host.textContent=round.is_host?'You are hosting':`Hosted by ${round.host_name}`;
  const people=document.createElement('div');people.className='tee-people';
  (round.participants||[]).filter(p=>p.invitation_status!=='declined').forEach(person=>{
    const chip=document.createElement('span');chip.className=`tee-person status-${person.invitation_status}`;
    const avatar=document.createElement('i');renderIdentityAvatar(avatar,person);const label=document.createElement('b');label.textContent=person.id===user?.id?'You':personLabel(person);
    const state=document.createElement('small');state.textContent=person.role==='host'?'Host':person.invitation_status==='accepted'?'Going':'Invited';chip.append(avatar,label,state);
    if(round.is_host&&person.role!=='host'&&['invited','accepted'].includes(person.invitation_status)){const remove=document.createElement('button');remove.type='button';remove.className='tee-person-remove';remove.dataset.roundAction='remove';remove.dataset.userId=person.id;remove.setAttribute('aria-label',`Remove ${personLabel(person)} from round`);remove.textContent='×';chip.append(remove)}
    people.append(chip);
  });
  body.append(title,host,people);
  if(round.notes){const notes=document.createElement('p');notes.className='tee-notes';notes.textContent=round.notes;body.append(notes)}
  const actions=document.createElement('div');actions.className='tee-actions';
  if(round.viewer_status==='invited')actions.append(button('Accept','accept','primary'),button('Decline','decline'));
  else if(round.status==='completed')actions.append(button('View scorecard','score','primary'));
  else if(round.is_host)actions.append(button(round.status==='in_progress'?'Score round':'Start round','score','primary'),...(round.status==='planned'?[button('Edit','edit'),button('Invite friends','invite'),button('Cancel round','cancel','quiet-danger')]:[]));
  else actions.append(button(round.status==='in_progress'?'Score round':'Start round','score','primary'),...(round.status==='planned'?[button('Leave round','leave','quiet-danger')]:[]));
  article.append(date,body,actions);return article;
}

function button(label,action,className=''){const el=document.createElement('button');el.type='button';el.className=`button ${className}`;el.dataset.roundAction=action;el.textContent=label;return el}

async function handleAction(event){
  if(event.target.closest('[data-plan-round]'))return openPlan();
  const control=event.target.closest('[data-round-action]');if(!control)return;
  const round=rounds.find(item=>item.id===control.closest('[data-round-id]')?.dataset.roundId);if(!round)return;
  const action=control.dataset.roundAction;
  if(action==='score'){location.hash=`scorecard/${round.id}`;return}
  if(action==='edit'||action==='invite')return openPlan(round,action==='invite');
  if(action==='cancel'&&!confirm('Cancel this planned round for everyone?'))return;
  if(action==='leave'&&!confirm('Leave this planned round?'))return;
  if(action==='remove'&&!confirm('Remove this golfer from the planned round?'))return;
  control.disabled=true;
  try{
    if(action==='accept'||action==='decline')await respondToRound(client,round.id,action==='accept'?'accepted':'declined');
    if(action==='cancel')await cancelRound(client,round.id);
    if(action==='leave')await leaveRound(client,round.id);
    if(action==='remove')await removePlayer(client,round.id,control.dataset.userId);
    await load();
  }catch(error){setMessage(friendlyError(error),true);control.disabled=false}
}

async function openPlan(round=null,inviteOnly=false){
  if(!courses.length){location.hash='courses';return}
  editingId=round?.id||null;
  form.dataset.inviteOnly=String(inviteOnly);
  document.getElementById('planDialogTitle').textContent=round?(inviteOnly?'Invite more golfers':'Edit tee time'):'Plan a round';
  document.getElementById('planCourse').disabled=inviteOnly;document.getElementById('planDate').disabled=inviteOnly;document.getElementById('planTime').disabled=inviteOnly;document.getElementById('planNotes').disabled=inviteOnly;
  document.getElementById('savePlan').textContent=inviteOnly?'Send invitations':round?'Save changes':'Plan round';
  fillCourses(round?.course_id);
  const at=round?new Date(round.scheduled_at):new Date(Date.now()+86400000);at.setMinutes(Math.ceil(at.getMinutes()/15)*15,0,0);
  document.getElementById('planDate').value=localDate(at);document.getElementById('planTime').value=at.toTimeString().slice(0,5);document.getElementById('planNotes').value=round?.notes||'';
  renderFriendChoices(round);
  if(!dialog.open)dialog.showModal();setTimeout(()=>dialog.querySelector('select:not(:disabled),input:not(:disabled)')?.focus(),0);
}

function fillCourses(selected){const select=document.getElementById('planCourse');select.replaceChildren();courses.forEach(course=>{const option=document.createElement('option');option.value=course.id;option.textContent=`${course.course} · ${course.tee} tees`;option.selected=course.id===selected;select.append(option)})}
function renderFriendChoices(round){
  const invited=new Set((round?.participants||[]).map(person=>person.id));const wrap=document.getElementById('planFriends');wrap.replaceChildren();
  const eligible=friends.filter(friend=>!invited.has(friend.id));
  if(!eligible.length){const p=document.createElement('p');p.className='friend-choice-empty';p.textContent=friends.length?'Everyone eligible is already on this round.':'No Fairway friends yet. Find golfers from the Friends page.';wrap.append(p);return}
  eligible.forEach(friend=>{const label=document.createElement('label');label.className='friend-choice';const input=document.createElement('input');input.type='checkbox';input.value=friend.id;input.checked=friend.id===prefillFriendId;const avatar=document.createElement('span');renderIdentityAvatar(avatar,friend);const text=document.createElement('span');const strong=document.createElement('strong');strong.textContent=personLabel(friend);const small=document.createElement('small');small.textContent=friend.handle?`@${friend.handle}`:'Fairway friend';text.append(strong,small);label.append(input,avatar,text);wrap.append(label)});prefillFriendId=null;
}

async function savePlan(event){
  event.preventDefault();const submit=document.getElementById('savePlan');submit.disabled=true;setDialogMessage('');
  try{
    const inviteOnly=form.dataset.inviteOnly==='true';let id=editingId;
    if(!inviteOnly){const date=document.getElementById('planDate').value,time=document.getElementById('planTime').value;const playAt=new Date(`${date}T${time}`);if(!date||!time||Number.isNaN(playAt.valueOf())||playAt<=new Date())throw new Error('Choose a future tee time.');
      const values={courseId:document.getElementById('planCourse').value,playAt:playAt.toISOString(),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',notes:document.getElementById('planNotes').value.trim()};
      if(id)await updatePlannedRound(client,id,values);else id=await createPlannedRound(client,values);
    }
    const selected=[...document.querySelectorAll('#planFriends input:checked')].map(input=>input.value);if(selected.length)await invitePlayers(client,id,selected);
    dialog.close();await load();
  }catch(error){setDialogMessage(friendlyError(error),true)}finally{submit.disabled=false}
}

function resetForm(){form.reset();editingId=null;form.dataset.inviteOnly='false';setDialogMessage('');['planCourse','planDate','planTime','planNotes'].forEach(id=>document.getElementById(id).disabled=false)}
function localDate(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function setMessage(text,error=false){const el=root.querySelector('[data-planned-message]');el.textContent=text;el.classList.toggle('sync-error',error)}
function setDialogMessage(text,error=false){const el=document.getElementById('planMessage');el.textContent=text;el.classList.toggle('sync-error',error)}
function friendlyError(error){const raw=String(error?.message||'');if(/future/i.test(raw))return 'Choose a tee time in the future.';if(/already invited/i.test(raw))return 'That golfer is already invited.';if(/friend unavailable|blocked/i.test(raw))return 'That golfer is no longer eligible for this round.';return socialError(error)}
