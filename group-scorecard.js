import { renderIdentityAvatar } from '/shared/identity.js?v=3';
import { personLabel,socialError } from '/shared/social.js?v=4';
import { loadGroupScorecard,savePlayerScorecard,completeGroupRound } from './group-scorecards.js';

const client=window.AppAuth?.client;
const root=document.querySelector('[data-group-scorecard]');
let round=null,roundId='',hole=0,saveTimers=new Map();

if(client&&root){
  root.addEventListener('click',handleClick);
  root.addEventListener('change',handleChange);
  window.addEventListener('fairway:view',route);
  route();
}

function route(){
  const match=location.hash.match(/^#scorecard\/([0-9a-f-]{36})$/i);
  if(!match)return;
  roundId=match[1];load();
}

async function load(){
  setMessage('Loading group scorecard…');root.setAttribute('aria-busy','true');
  try{round=await loadGroupScorecard(client,roundId);render();setMessage('')}
  catch(error){round=null;renderUnavailable(socialError(error));setMessage('')}
  finally{root.removeAttribute('aria-busy')}
}

function render(){
  const when=new Date(round.scheduled_at);
  root.querySelector('[data-scorecard-title]').textContent=round.course_name;
  root.querySelector('[data-scorecard-meta]').textContent=`${round.tee_name} tees · Par ${round.par} · ${when.toLocaleDateString([], {month:'long',day:'numeric',year:'numeric'})}`;
  root.querySelector('[data-scorecard-state]').textContent=round.status==='completed'?'Completed':round.status==='in_progress'?'In progress':'Ready to score';
  root.querySelector('[data-scorecard-desktop]').replaceChildren(desktopCard());
  renderMobile();
  const complete=root.querySelector('[data-complete-round]');
  complete.hidden=round.host_id!==round.viewer_id||round.status==='completed';
  complete.disabled=!allCardsComplete();
  root.querySelector('[data-complete-help]').textContent=round.status==='completed'?'Final scores are saved with this shared round.':allCardsComplete()?'All 18-hole cards are ready. Completing locks the shared round.':'Every accepted golfer needs all 18 scores before the host can complete the round.';
}

function canEdit(player){return round.status!=='completed'&&(player.id===round.viewer_id||round.designated_scorer_id===round.viewer_id)}
function scores(player){return Array.from({length:18},(_,i)=>player.holes?.[i]??null)}
function totalThrough(player,end=18){return scores(player).slice(0,end).reduce((sum,value)=>sum+(Number(value)||0),0)}
function completedHoles(player){return scores(player).filter(Boolean).length}
function allCardsFinal(){return round.participants.length>0&&round.participants.every(p=>p.scorecard_status==='final'&&completedHoles(p)===18)}
function allCardsComplete(){return round.participants.length>0&&round.participants.every(p=>completedHoles(p)===18)}

function desktopCard(){
  const wrap=document.createElement('div');wrap.className='group-score-table-wrap';wrap.tabIndex=0;wrap.setAttribute('aria-label','Group scorecard, horizontally scrollable when needed');
  const table=document.createElement('table');table.className='group-score-table';
  const head=document.createElement('thead');const hr=document.createElement('tr');
  hr.append(th('Golfer','player'));for(let i=1;i<=18;i++)hr.append(th(String(i),i===10?'turn':''));['F9','B9','Total','+/−'].forEach(label=>hr.append(th(label,'total')));head.append(hr);table.append(head);
  const body=document.createElement('tbody');round.participants.forEach(player=>{
    const tr=document.createElement('tr');tr.classList.toggle('viewer-row',player.id===round.viewer_id);
    const playerCell=document.createElement('th');playerCell.scope='row';playerCell.className='group-player-cell';
    const avatar=document.createElement('span');avatar.className='group-avatar';renderIdentityAvatar(avatar,player);
    const label=document.createElement('span');const strong=document.createElement('strong');strong.textContent=player.id===round.viewer_id?'You':personLabel(player);const small=document.createElement('small');small.textContent=player.scorecard_status==='final'?'Final':`${completedHoles(player)}/18`;label.append(strong,small);playerCell.append(avatar,label);tr.append(playerCell);
    scores(player).forEach((value,index)=>{const td=document.createElement('td');if(index===9)td.classList.add('turn');td.append(scoreInput(player,index,value,'desktop'));tr.append(td)});
    const playerScores=scores(player);const total=totalThrough(player);tr.append(valueCell(totalThrough(player,9)||null),valueCell(playerScores.slice(9).reduce((sum,value)=>sum+(Number(value)||0),0)||null),valueCell(completedHoles(player)?total:null,true),valueCell(completedHoles(player)===18?toPar(total-round.par):null));body.append(tr);
  });table.append(body);wrap.append(table);return wrap;
}
function th(text,className=''){const el=document.createElement('th');el.textContent=text;if(className)el.className=className;return el}
function valueCell(value,strong=false){const td=document.createElement('td');td.className=`score-total${strong?' grand':''}`;td.textContent=value??'—';return td}
function toPar(value){return value===0?'E':value>0?`+${value}`:String(value)}
function scoreInput(player,index,value,context){const input=document.createElement('input');input.type='number';input.inputMode='numeric';input.min='1';input.max='20';input.value=value??'';input.disabled=!canEdit(player)||player.scorecard_status==='final';input.dataset.scorePlayer=player.id;input.dataset.hole=String(index);input.dataset.context=context;input.setAttribute('aria-label',`${personLabel(player)}, hole ${index+1} score`);return input}

function renderMobile(){
  root.querySelector('[data-current-hole]').textContent=`Hole ${hole+1}`;
  root.querySelector('[data-hole-position]').textContent=`${hole<9?'Front nine':'Back nine'} · ${hole+1} of 18`;
  root.querySelector('[data-prev-hole]').disabled=hole===0;root.querySelector('[data-next-hole]').disabled=hole===17;
  const list=root.querySelector('[data-mobile-players]');list.replaceChildren();
  round.participants.forEach(player=>{
    const row=document.createElement('article');row.className='mobile-score-player';
    const identity=document.createElement('div');identity.className='mobile-player-identity';const avatar=document.createElement('span');avatar.className='group-avatar';renderIdentityAvatar(avatar,player);const names=document.createElement('span');const strong=document.createElement('strong');strong.textContent=player.id===round.viewer_id?'You':personLabel(player);const small=document.createElement('small');small.textContent=`${totalThrough(player,hole+1)||'—'} through ${hole+1}`;names.append(strong,small);identity.append(avatar,names);
    const controls=document.createElement('div');controls.className='mobile-score-control';const editable=canEdit(player)&&player.scorecard_status!=='final';
    const minus=stepButton('−',player.id,-1,editable,`Decrease ${personLabel(player)} hole ${hole+1} score`);const input=scoreInput(player,hole,scores(player)[hole],'mobile');const plus=stepButton('+',player.id,1,editable,`Increase ${personLabel(player)} hole ${hole+1} score`);controls.append(minus,input,plus);row.append(identity,controls);list.append(row);
  });
  const mine=round.participants.find(p=>p.id===round.viewer_id);const final=root.querySelector('[data-finalize-card]');final.hidden=!mine||round.status==='completed'||mine.scorecard_status==='final';final.disabled=!mine||completedHoles(mine)!==18;final.textContent=mine?.scorecard_status==='final'?'Card final':'Finish my scorecard';
}
function stepButton(text,playerId,delta,enabled,label){const button=document.createElement('button');button.type='button';button.className='score-step';button.textContent=text;button.dataset.stepPlayer=playerId;button.dataset.delta=String(delta);button.disabled=!enabled;button.setAttribute('aria-label',label);return button}

function handleChange(event){const input=event.target.closest('[data-score-player]');if(!input)return;const player=round.participants.find(p=>p.id===input.dataset.scorePlayer);if(!player||!canEdit(player))return;const value=Number(input.value);player.holes= scores(player);player.holes[Number(input.dataset.hole)]=Number.isInteger(value)&&value>=1&&value<=20?value:null;player.scorecard_status='draft';queueSave(player);render()}
async function handleClick(event){
  if(event.target.closest('[data-scorecard-back]')){location.hash='upcoming';return}
  if(event.target.closest('[data-prev-hole]')){hole=Math.max(0,hole-1);renderMobile();return}
  if(event.target.closest('[data-next-hole]')){hole=Math.min(17,hole+1);renderMobile();return}
  const step=event.target.closest('[data-step-player]');if(step){const player=round.participants.find(p=>p.id===step.dataset.stepPlayer);if(!player||!canEdit(player))return;player.holes=scores(player);const current=Number(player.holes[hole])||0;player.holes[hole]=Math.min(20,Math.max(1,current+Number(step.dataset.delta)));player.scorecard_status='draft';queueSave(player);render();return}
  if(event.target.closest('[data-finalize-card]')){const player=round.participants.find(p=>p.id===round.viewer_id);if(!player||completedHoles(player)!==18)return;await save(player,'final');return}
  if(event.target.closest('[data-complete-round]')){const button=event.target.closest('button');button.disabled=true;try{for(const player of round.participants){if(player.scorecard_status!=='final')await savePlayerScorecard(client,round.id,player.id,scores(player),'final')}await completeGroupRound(client,round.id);await load()}catch(error){setMessage(socialError(error),true);button.disabled=false}}
}
function queueSave(player){clearTimeout(saveTimers.get(player.id));setMessage('Saving…');saveTimers.set(player.id,setTimeout(()=>save(player,'draft'),450))}
async function save(player,status){
  try{await savePlayerScorecard(client,round.id,player.id,scores(player),status);player.scorecard_status=status;setMessage(status==='final'?'Scorecard finalized.':'Saved');setTimeout(()=>setMessage(''),1200);await load()}
  catch(error){setMessage(socialError(error),true)}
}
function renderUnavailable(message){root.querySelector('[data-scorecard-title]').textContent='Scorecard unavailable';root.querySelector('[data-scorecard-meta]').textContent=message;root.querySelector('[data-scorecard-desktop]').replaceChildren();root.querySelector('[data-mobile-players]').replaceChildren()}
function setMessage(text,error=false){const el=root.querySelector('[data-scorecard-message]');el.textContent=text;el.classList.toggle('sync-error',error)}
