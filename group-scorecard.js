import { renderIdentityAvatar } from '/shared/identity.js?v=3';
import { personLabel,socialError } from '/shared/social.js?v=4';
import { loadGroupScorecard,savePlayerScorecard,completeGroupRound } from './group-scorecards.js';

const client=window.AppAuth?.client;
const root=document.querySelector('[data-group-scorecard]');
let round=null,roundId='',saveTimers=new Map();

if(client&&root){
  root.addEventListener('click',handleClick);
  root.addEventListener('change',handleChange);
  root.addEventListener('keydown',handleScoreKeys);
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
  root.querySelector('[data-scorecard-meta]').textContent=`${holeCount()} holes · ${round.tee_name} tees · Par ${round.par} · ${when.toLocaleDateString([], {month:'long',day:'numeric',year:'numeric'})}`;
  root.querySelector('[data-scorecard-cue]').textContent=`All ${holeCount()} holes, arranged vertically`;
  root.querySelector('[data-scorecard-state]').textContent=round.status==='completed'?'Completed':round.status==='in_progress'?'In progress':'Ready to score';
  root.querySelector('[data-scorecard-table]').replaceChildren(scorecard(),mobileScorecard());
  renderSummary();
  updateCompletionControls();
}

function updateCompletionControls(){
  const complete=root.querySelector('[data-complete-round]');
  complete.hidden=round.host_id!==round.viewer_id||round.status==='completed';
  complete.disabled=!allCardsComplete();
  root.querySelector('[data-complete-help]').textContent=round.status==='completed'?'Final scores are saved with this shared round.':allCardsComplete()?`All ${holeCount()}-hole cards are ready. Completing locks the shared round.`:`Every accepted golfer needs all ${holeCount()} scores before the host can complete the round.`;
  const mine=round.participants.find(p=>p.id===round.viewer_id);const final=root.querySelector('[data-finalize-card]');final.hidden=!mine||round.status==='completed'||mine.scorecard_status==='final';final.disabled=!mine||completedHoles(mine)!==holeCount();final.textContent=mine?.scorecard_status==='final'?'Card final':'Finish my scorecard';
}

function canEdit(player){return round.status!=='completed'&&(player.id===round.viewer_id||round.designated_scorer_id===round.viewer_id)}
function holeCount(){return Number(round?.hole_count)===9?9:18}
function scores(player){return Array.from({length:holeCount()},(_,i)=>player.holes?.[i]??null)}
function completedHoles(player){return scores(player).filter(Boolean).length}
function allCardsComplete(){return round.participants.length>0&&round.participants.every(p=>completedHoles(p)===holeCount())}

function scorecard(){
  const wrap=document.createElement('div');wrap.className='group-score-table-wrap';wrap.tabIndex=0;wrap.setAttribute('aria-label','Group scorecard');
  const table=document.createElement('table');table.className='group-score-table';
  const head=document.createElement('thead');const groups=document.createElement('tr');groups.className='scorecard-groups';
  const golfer=th('Golfer','player');golfer.rowSpan=2;groups.append(golfer,groupHeading('Front nine',9));if(holeCount()===18)groups.append(groupHeading('Back nine',9));groups.append(groupHeading('Round',holeCount()===18?4:3,'totals-group'));
  const holes=document.createElement('tr');for(let i=1;i<=holeCount();i++)holes.append(th(String(i),i===10?'turn':''));(holeCount()===18?['F9','B9','Total','+/−']:['F9','Total','+/−']).forEach(label=>holes.append(th(label,'total')));head.append(groups,holes);table.append(head);
  const body=document.createElement('tbody');round.participants.forEach(player=>{
    const tr=document.createElement('tr');tr.classList.toggle('viewer-row',player.id===round.viewer_id);
    const playerCell=document.createElement('th');playerCell.scope='row';playerCell.className='group-player-cell';
    const avatar=document.createElement('span');avatar.className='group-avatar';renderIdentityAvatar(avatar,player);
    const label=document.createElement('span');const strong=document.createElement('strong');strong.textContent=player.id===round.viewer_id?'You':personLabel(player);const small=document.createElement('small');small.dataset.playerProgress=player.id;small.textContent=player.scorecard_status==='final'?'Final':`${completedHoles(player)}/${holeCount()} holes`;label.append(strong,small);playerCell.append(avatar,label);tr.append(playerCell);
    scores(player).forEach((value,index)=>{const td=document.createElement('td');if(index===9)td.classList.add('turn');td.append(scoreInput(player,index,value,'desktop'));tr.append(td)});
    tr.append(summaryCell(player,'front'));if(holeCount()===18)tr.append(summaryCell(player,'back'));tr.append(summaryCell(player,'total',true),summaryCell(player,'par'));body.append(tr);
  });table.append(body);wrap.append(table);return wrap;
}
function mobileScorecard(){
  const card=document.createElement('div');card.className='mobile-vertical-scorecard';card.setAttribute('aria-label','Vertical group scorecard');
  (holeCount()===18?[['Front nine',0,9],['Back nine',9,18]]:[['Nine holes',0,9]]).forEach(([label,start,end])=>{
    const section=document.createElement('section');section.className='mobile-nine-section';
    const heading=document.createElement('header');heading.className='mobile-nine-heading';const title=document.createElement('strong');title.textContent=label;const range=document.createElement('span');range.textContent=`Holes ${start+1}–${end}`;heading.append(title,range);section.append(heading);
    for(let index=start;index<end;index++){
      const hole=document.createElement('article');hole.className='mobile-hole-block';
      const number=document.createElement('header');number.className='mobile-hole-number';const caption=document.createElement('small');caption.textContent='Hole';const strong=document.createElement('strong');strong.textContent=String(index+1);number.append(caption,strong);
      const players=document.createElement('div');players.className='mobile-hole-players';
      round.participants.forEach(player=>{const row=document.createElement('div');row.className=`mobile-hole-player${player.id===round.viewer_id?' is-viewer':''}`;const identity=document.createElement('div');identity.className='mobile-hole-identity';const avatar=document.createElement('span');avatar.className='group-avatar';renderIdentityAvatar(avatar,player);const name=document.createElement('span');name.textContent=player.id===round.viewer_id?'You':personLabel(player);identity.append(avatar,name);row.append(identity,scoreInput(player,index,scores(player)[index],'mobile'));players.append(row)});
      hole.append(number,players);section.append(hole);
    }
    card.append(section);
  });
  return card;
}
function groupHeading(text,span,className=''){const el=th(text,className);el.colSpan=span;el.scope='colgroup';return el}
function th(text,className=''){const el=document.createElement('th');el.textContent=text;if(className)el.className=className;return el}
function summaryCell(player,kind,strong=false){const td=document.createElement('td');td.className=`score-total${strong?' grand':''}${kind==='par'?' score-to-par':''}`;td.dataset.summaryPlayer=player.id;td.dataset.summaryKind=kind;td.textContent=summaryValue(player,kind);return td}
function toPar(value){return value===0?'E':value>0?`+${value}`:String(value)}
function scoreInput(player,index,value,context){const input=document.createElement('input');input.type='number';input.inputMode='numeric';input.min='1';input.max='20';input.value=value??'';input.disabled=!canEdit(player)||player.scorecard_status==='final';input.dataset.scorePlayer=player.id;input.dataset.hole=String(index);input.dataset.context=context;input.setAttribute('aria-label',`${personLabel(player)}, hole ${index+1} score`);return input}

function summaryValue(player,kind){const playerScores=scores(player),done=completedHoles(player),front=playerScores.slice(0,9).reduce((sum,value)=>sum+(Number(value)||0),0),back=playerScores.slice(9).reduce((sum,value)=>sum+(Number(value)||0),0),total=front+back;if(kind==='front')return front||'—';if(kind==='back')return back||'—';if(kind==='total')return done?total:'—';return done===holeCount()?toPar(total-round.par):'—'}
function renderSummary(){const rail=root.querySelector('[data-scorecard-summary]');rail.replaceChildren();round.participants.forEach(player=>{const card=document.createElement('article');card.className=`scorecard-player-summary${player.id===round.viewer_id?' is-viewer':''}`;const name=document.createElement('div');name.className='scorecard-summary-name';const strong=document.createElement('strong');strong.textContent=player.id===round.viewer_id?'You':personLabel(player);const small=document.createElement('small');small.textContent=player.scorecard_status==='final'?'Card final':`${completedHoles(player)}/${holeCount()} holes`;name.append(strong,small);card.append(name);const stats=holeCount()===18?[['F9','front'],['B9','back'],['Total','total'],['To par','par']]:[['9 holes','front'],['Total','total'],['To par','par']];stats.forEach(([label,kind])=>{const stat=document.createElement('span');stat.className=`scorecard-stat${kind==='par'?' score-to-par':''}`;const caption=document.createElement('small');caption.textContent=label;const value=document.createElement('strong');value.textContent=summaryValue(player,kind);stat.append(caption,value);card.append(stat)});rail.append(card)})}
function refreshComputed(){round.participants.forEach(player=>{root.querySelectorAll(`[data-summary-player="${player.id}"]`).forEach(cell=>cell.textContent=summaryValue(player,cell.dataset.summaryKind));const progress=root.querySelector(`[data-player-progress="${player.id}"]`);if(progress)progress.textContent=player.scorecard_status==='final'?'Final':`${completedHoles(player)}/${holeCount()} holes`});renderSummary();updateCompletionControls()}

function handleChange(event){const input=event.target.closest('[data-score-player]');if(!input)return;const player=round.participants.find(p=>p.id===input.dataset.scorePlayer);if(!player||!canEdit(player))return;const value=Number(input.value),hole=Number(input.dataset.hole),score=Number.isInteger(value)&&value>=1&&value<=20?value:null;player.holes=scores(player);player.holes[hole]=score;player.scorecard_status='draft';root.querySelectorAll(`[data-score-player="${player.id}"][data-hole="${hole}"]`).forEach(peer=>{if(peer!==input)peer.value=score??''});queueSave(player);refreshComputed()}
function handleScoreKeys(event){const input=event.target.closest('[data-score-player]');if(!input||!['Enter','ArrowRight','ArrowLeft'].includes(event.key))return;event.preventDefault();const nextHole=Math.max(0,Math.min(holeCount()-1,Number(input.dataset.hole)+(event.key==='ArrowLeft'?-1:1)));root.querySelector(`[data-score-player="${input.dataset.scorePlayer}"][data-hole="${nextHole}"][data-context="${input.dataset.context}"]`)?.focus()}
async function handleClick(event){
  if(event.target.closest('[data-scorecard-back]')){location.hash='upcoming';return}
  if(event.target.closest('[data-finalize-card]')){const player=round.participants.find(p=>p.id===round.viewer_id);if(!player||completedHoles(player)!==holeCount())return;await save(player,'final');return}
  if(event.target.closest('[data-complete-round]')){const button=event.target.closest('button');button.disabled=true;try{for(const player of round.participants){if(player.scorecard_status!=='final')await savePlayerScorecard(client,round.id,player.id,scores(player),'final')}await completeGroupRound(client,round.id);window.dispatchEvent(new CustomEvent('fairway:personal-history-updated',{detail:{roundId:round.id}}));await load()}catch(error){setMessage(socialError(error),true);button.disabled=false}}
}
function queueSave(player){clearTimeout(saveTimers.get(player.id));setMessage('Saving…');saveTimers.set(player.id,setTimeout(()=>save(player,'draft'),450))}
async function save(player,status){
  if(status==='final'){clearTimeout(saveTimers.get(player.id));saveTimers.delete(player.id)}
  try{await savePlayerScorecard(client,round.id,player.id,scores(player),status);player.scorecard_status=status;setMessage(status==='final'?'Scorecard finalized.':'Saved');refreshComputed();setTimeout(()=>setMessage(''),1200);if(status==='final')await load()}
  catch(error){setMessage(socialError(error),true)}
}
function renderUnavailable(message){root.querySelector('[data-scorecard-title]').textContent='Scorecard unavailable';root.querySelector('[data-scorecard-meta]').textContent=message;root.querySelector('[data-scorecard-table]').replaceChildren();root.querySelector('[data-scorecard-summary]').replaceChildren()}
function setMessage(text,error=false){const el=root.querySelector('[data-scorecard-message]');el.textContent=text;el.classList.toggle('sync-error',error)}
