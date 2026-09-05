import {
  listRelationshipPeople,setFollow,requestFriend,cancelFriendRequest,respondFriend,
  removeFriend,blockUser,personLabel,socialError
} from '/shared/social.js?v=3';
import { renderIdentityAvatar } from '/shared/identity.js?v=3';

const client = window.AppAuth?.client;
const root = document.querySelector('[data-fairway-social]');
let user = null;
let active = 'friends';
let rows = [];
let searchQuery = '';

if (client && root) {
  root.addEventListener('click', handleClick);
  root.addEventListener('keydown', handleTabKeys);
  root.querySelector('[data-golfer-search]').addEventListener('submit', runSearch);
  client.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
  client.auth.getSession().then(({data}) => setUser(data.session?.user || null));
}

async function setUser(next) {
  if (user?.id === next?.id) return;
  user = next;
  if (user) await loadActive();
}

async function loadActive() {
  setMessage('Checking your golf circle…');
  root.setAttribute('aria-busy','true');
  try {
    rows = active === 'golfers' && !searchQuery
      ? []
      : await listRelationshipPeople(client, active === 'golfers' ? 'search' : active, searchQuery);
    render(); setMessage('');
  } catch (error) { rows=[]; render(); setMessage(socialError(error),true); }
  finally { root.setAttribute('aria-busy','false'); }
}

async function runSearch(event) {
  event.preventDefault(); searchQuery=root.querySelector('#golferSearch').value.trim(); active='golfers'; await loadActive();
}

async function handleClick(event) {
  const tab=event.target.closest('[data-fairway-connection-tab]');
  if(tab){active=tab.dataset.fairwayConnectionTab;updateTabs();await loadActive();return;}
  const button=event.target.closest('[data-social-action]');if(!button)return;
  button.disabled=true;
  try {
    const action=button.dataset.socialAction,id=button.dataset.userId,requestId=button.dataset.requestId;
    if(action==='follow')await setFollow(client,id,true);
    if(action==='unfollow')await setFollow(client,id,false);
    if(action==='friend')await requestFriend(client,id);
    if(action==='cancel-request')await cancelFriendRequest(client,requestId);
    if(action==='accept')await respondFriend(client,requestId,'accepted');
    if(action==='decline')await respondFriend(client,requestId,'declined');
    if(action==='remove-friend'&&confirm('Remove this golfer from your friends? Your private rounds remain unchanged.'))await removeFriend(client,id);
    if(action==='block'&&confirm('Block this golfer? Your connection and pending requests will be removed.'))await blockUser(client,id);
    await loadActive();
  } catch(error){setMessage(socialError(error),true);button.disabled=false;}
}

function handleTabKeys(event){
  const current=event.target.closest('[data-fairway-connection-tab]');if(!current||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const tabs=[...root.querySelectorAll('[data-fairway-connection-tab]')];let index=tabs.indexOf(current);
  if(event.key==='Home')index=0;else if(event.key==='End')index=tabs.length-1;else index=(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  event.preventDefault();tabs[index].focus();tabs[index].click();
}

function render(){
  updateTabs();const output=root.querySelector('[data-fairway-connection-results]');output.replaceChildren();
  if(!rows.length)return output.append(emptyState());
  rows.forEach(person=>output.append(golferRow(person)));
}

function updateTabs(){
  root.querySelectorAll('[data-fairway-connection-tab]').forEach(button=>{const selected=button.dataset.fairwayConnectionTab===active;button.classList.toggle('active',selected);button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;});
  root.querySelector('[data-golfer-search]').hidden=active!=='golfers';
}

function golferRow(person){
  const row=document.createElement('article');row.className='golfer-row';
  const avatar=document.createElement('span');avatar.className='golfer-avatar';avatar.setAttribute('aria-hidden','true');renderIdentityAvatar(avatar,person);
  const identity=document.createElement('div');identity.className='golfer-identity';
  const name=document.createElement('strong');name.textContent=personLabel(person);
  const handle=document.createElement('span');handle.textContent=person.handle?`@${person.handle}`:'No public handle';
  const bio=document.createElement('p');bio.textContent=person.bio||'No public bio.';identity.append(name,handle,bio);
  const states=document.createElement('div');states.className='golfer-states';
  if(person.is_friend)states.append(state('Friend'));
  if(person.is_following)states.append(state('Following'));
  if(person.is_follower)states.append(state('Follows you'));
  if(person.request_direction==='incoming')states.append(state('Request received'));
  if(person.request_direction==='outgoing')states.append(state('Request sent'));
  identity.append(states);
  const actions=document.createElement('div');actions.className='golfer-actions';
  actions.append(action(person.is_following?'Unfollow':person.is_follower?'Follow back':'Follow',person.is_following?'unfollow':'follow',person));
  if(person.request_direction==='incoming')actions.append(action('Accept','accept',person,'primary'),action('Decline','decline',person));
  else if(person.request_direction==='outgoing')actions.append(action('Cancel request','cancel-request',person));
  else if(person.is_friend)actions.append(action('Remove friend','remove-friend',person));
  else actions.append(action('Add friend','friend',person,'primary'));
  actions.append(action('Block','block',person,'quiet-danger'));
  row.append(avatar,identity,actions);return row;
}

function emptyState(){
  const copy={friends:['No Fairway friends yet.','Find golfers you know and send a friend request.'],requests:['No friend requests.','Incoming and outgoing requests will appear here.'],following:['You are not following anyone yet.','Follow golfers without sharing private rounds.'],followers:['No followers yet.','Followers never gain access to private rounds.'],golfers:searchQuery?['No golfers found.','Try another display name or @handle.']:['Find golfers.','Search the ecosystem by display name or @handle.']}[active];
  const empty=document.createElement('div');empty.className='social-empty';const flag=document.createElement('span');flag.textContent='○';flag.setAttribute('aria-hidden','true');const strong=document.createElement('strong');strong.textContent=copy[0];const text=document.createElement('p');text.textContent=copy[1];empty.append(flag,strong,text);return empty;
}

function action(label,name,person,className=''){const button=document.createElement('button');button.type='button';button.className=`button social-action ${className}`;button.textContent=label;button.dataset.socialAction=name;button.dataset.userId=person.id;if(person.request_id)button.dataset.requestId=person.request_id;return button;}
function state(text){const span=document.createElement('span');span.textContent=text;return span;}
function setMessage(text,error=false){const el=root.querySelector('[data-social-message]');el.textContent=text;el.classList.toggle('sync-error',error);}
