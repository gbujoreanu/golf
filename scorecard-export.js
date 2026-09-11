const SIZE=1080;
const BACKGROUND_URL=new URL('./assets/fairway-share-bg.png?v=1',import.meta.url).href;
const COLORS={gold:'#d8b567',goldSoft:'#f1d99e',cream:'#f8f2df',muted:'#c4c9b9',panel:'rgba(3,25,18,.91)',panelSoft:'rgba(7,38,27,.84)',line:'rgba(216,181,103,.58)',green:'#8ed081'};

export function toPar(value){const score=Number(value)||0;return score===0?'E':score>0?`+${score}`:String(score)}

export function normalizeScorecard(input){
  const holeCount=Number(input?.holeCount)===9?9:18;
  const participants=(input?.participants||[]).map((person,index)=>{
    const holes=Array.from({length:holeCount},(_,hole)=>Number(person?.holes?.[hole])||0);
    const front=sum(holes.slice(0,9)),back=holeCount===18?sum(holes.slice(9)):null,total=front+(back||0);
    return {id:person?.id||String(index),name:String(person?.name||`Golfer ${index+1}`).trim(),holes,front,back,total,toPar:toPar(total-Number(input?.par||0))};
  });
  return {course:String(input?.course||'Completed round').trim(),date:input?.date,tee:String(input?.tee||'').trim(),teeTime:input?.teeTime||'',holeCount,par:Number(input?.par)||0,participants};
}

export function scorecardHighlights(input){
  const card=normalizeScorecard(input),players=card.participants;
  if(!players.length)return [];
  if(players.length===1){const player=players[0];return card.holeCount===18?[['Front 9',String(player.front)],['Back 9',String(player.back)],['Total',String(player.total)],['To par',player.toPar]]:[['Nine holes',String(player.front)],['Total',String(player.total)],['To par',player.toPar]]}
  const winner=leaders(players,'total'),front=leaders(players,'front');
  if(card.holeCount===9)return [['Winner',winner.names],['Winning score',`${winner.score} (${toPar(winner.score-card.par)})`],['Closest Match',closestMatch(players)]];
  const back=leaders(players,'back');
  return [['Winner',`${winner.names} · ${winner.score}`],['Best Front 9',`${front.names} · ${front.score}`],['Best Back 9',`${back.names} · ${back.score}`],['Closest Match',closestMatch(players)]];
}

export async function downloadScorecardPng(input){
  const card=normalizeScorecard(input);
  if(!card.participants.length||card.participants.some(person=>person.holes.some(score=>score<1)))throw new Error('Only completed scorecards can be downloaded.');
  const blob=await renderScorecardPng(card);const url=URL.createObjectURL(blob);const link=document.createElement('a');
  link.href=url;link.download=scorecardFilename(card);link.rel='noopener';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  return link.download;
}

export async function renderScorecardPng(input){
  const card=normalizeScorecard(input),canvas=document.createElement('canvas');canvas.width=SIZE;canvas.height=SIZE;
  const ctx=canvas.getContext('2d',{alpha:false});await drawBackground(ctx);drawCard(ctx,card);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('The scorecard image could not be created.')),'image/png'));
}

export function scorecardFilename(input){const card=normalizeScorecard(input);return `fairway-${slug(card.course)||'round'}-${dateKey(card.date)}.png`}

function sum(values){return values.reduce((total,value)=>total+(Number(value)||0),0)}
function leaders(players,key){const best=Math.min(...players.map(player=>player[key]));return {score:best,names:players.filter(player=>player[key]===best).map(player=>player.name).join(' & ')}}
function closestMatch(players){let best=null;for(let a=0;a<players.length;a++)for(let b=a+1;b<players.length;b++){const gap=Math.abs(players[a].total-players[b].total);if(!best||gap<best.gap)best={gap,names:`${players[a].name} & ${players[b].name}`}}return best?`${best.names} · ${best.gap} stroke${best.gap===1?'':'s'}`:'—'}
function slug(value){return String(value||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)}
function dateKey(value){const date=parseDate(value);return Number.isNaN(date.getTime())?'round':`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function parseDate(value){if(/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return new Date(`${value}T12:00:00`);return new Date(value)}
function dateLabel(value){const date=parseDate(value);return Number.isNaN(date.getTime())?'DATE NOT AVAILABLE':date.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric',year:'numeric'}).toUpperCase()}

async function drawBackground(ctx){
  ctx.fillStyle='#031b13';ctx.fillRect(0,0,SIZE,SIZE);
  try{const image=await loadImage(BACKGROUND_URL);ctx.drawImage(image,0,0,SIZE,SIZE)}catch{}
  const shade=ctx.createLinearGradient(0,0,0,SIZE);shade.addColorStop(0,'rgba(0,18,13,.36)');shade.addColorStop(.72,'rgba(0,15,10,.48)');shade.addColorStop(1,'rgba(0,8,5,.16)');ctx.fillStyle=shade;ctx.fillRect(0,0,SIZE,SIZE);
}
function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src})}

function drawCard(ctx,card){
  roundRect(ctx,48,42,984,930,28,COLORS.panel,COLORS.gold,2);roundRect(ctx,61,55,958,904,20,null,COLORS.line,1);
  ctx.textAlign='center';label(ctx,'FAIRWAY',540,102,18,COLORS.gold,700);fit(ctx,'ROUND SUMMARY',540,168,62,850,COLORS.cream,860,'center','Georgia');fit(ctx,card.course,540,218,31,600,COLORS.goldSoft,860,'center','Georgia');
  const meta=[dateLabel(card.date),card.tee?`${card.tee.toUpperCase()} TEES`:'TEE NOT LISTED',`${card.holeCount} HOLES`,card.par?`PAR ${card.par}`:''];if(card.teeTime)meta.splice(2,0,String(card.teeTime).toUpperCase());
  fit(ctx,meta.filter(Boolean).join('   •   '),540,256,13,700,COLORS.muted,860);
  const tableBottom=drawScoreTable(ctx,card,78,290,924);
  drawHighlights(ctx,scorecardHighlights(card),78,Math.max(620,tableBottom+28),924);
  line(ctx,270,933,810,933,COLORS.line,1);label(ctx,'YOUR ROUND, CLEARLY SCORED',540,940,12,COLORS.goldSoft,700);
}

function drawScoreTable(ctx,card,x,y,width){
  const rowHeight=Math.max(30,Math.min(58,360/Math.max(card.participants.length,1))),headerHeight=46,totalHeight=headerHeight+rowHeight*card.participants.length;
  roundRect(ctx,x,y,width,totalHeight,10,COLORS.panelSoft,COLORS.gold,1.4);
  const nameWidth=card.holeCount===18?154:210,totalColumns=card.holeCount===18?4:3,totalWidth=card.holeCount===18?190:240,holeWidth=(width-nameWidth-totalWidth)/card.holeCount;
  const totalLabels=card.holeCount===18?['F9','B9','TOTAL','+/−']:['9','TOTAL','+/−'];const totalCellWidth=totalWidth/totalColumns;
  ctx.textBaseline='middle';ctx.textAlign='center';label(ctx,'GOLFER',x+12,y+headerHeight/2,12,COLORS.goldSoft,700,'left');
  for(let hole=0;hole<card.holeCount;hole++)label(ctx,String(hole+1),x+nameWidth+holeWidth*(hole+.5),y+headerHeight/2,11,COLORS.goldSoft,700);
  totalLabels.forEach((text,index)=>label(ctx,text,x+nameWidth+holeWidth*card.holeCount+totalCellWidth*(index+.5),y+headerHeight/2,11,COLORS.goldSoft,700));
  line(ctx,x,y+headerHeight,x+width,y+headerHeight,COLORS.gold,1);
  card.participants.forEach((person,row)=>{
    const top=y+headerHeight+rowHeight*row,center=top+rowHeight/2;if(row)line(ctx,x,top,x+width,top,COLORS.line,.7);
    fit(ctx,person.name,x+12,center,16,650,COLORS.cream,nameWidth-22,'left','Georgia');person.holes.forEach((score,hole)=>label(ctx,String(score),x+nameWidth+holeWidth*(hole+.5),center,15,COLORS.cream,600));
    const values=card.holeCount===18?[person.front,person.back,person.total,person.toPar]:[person.front,person.total,person.toPar];values.forEach((value,index)=>label(ctx,String(value),x+nameWidth+holeWidth*card.holeCount+totalCellWidth*(index+.5),center,index===values.length-2?17:15,index===values.length-1?COLORS.green:COLORS.cream,700));
  });
  line(ctx,x+nameWidth,y,x+nameWidth,y+totalHeight,COLORS.gold,1);line(ctx,x+nameWidth+holeWidth*card.holeCount,y,x+nameWidth+holeWidth*card.holeCount,y+totalHeight,COLORS.gold,1);
  return y+totalHeight;
}

function drawHighlights(ctx,items,x,y,width){
  const count=items.length,boxHeight=142;roundRect(ctx,x,y,width,boxHeight,10,'rgba(3,25,18,.9)',COLORS.line,1);
  items.forEach(([title,value],index)=>{const left=x+width/count*index,center=left+width/count/2;if(index)line(ctx,left,y+18,left,y+boxHeight-18,COLORS.line,1);label(ctx,title.toUpperCase(),center,y+42,11,COLORS.gold,700);fit(ctx,value,center,y+82,21,600,COLORS.cream,width/count-26,'center','Georgia')});
}

function line(ctx,x1,y1,x2,y2,color,width){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
function roundRect(ctx,x,y,width,height,radius,fill,stroke,lineWidth=1){ctx.beginPath();ctx.roundRect(x,y,width,height,radius);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke()}}
function label(ctx,text,x,y,size,color,weight=600,align='center',family='Arial'){ctx.save();ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.font=`${weight} ${size}px ${family}`;ctx.fillText(text,x,y);ctx.restore()}
function fit(ctx,text,x,y,size,weight,color,maxWidth,align='center',family='Arial'){ctx.save();ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;let current=size,output=String(text);do{ctx.font=`${weight} ${current}px ${family}`;current-=1}while(current>10&&ctx.measureText(output).width>maxWidth);while(output.length>1&&ctx.measureText(output).width>maxWidth)output=`${output.slice(0,-2)}…`;ctx.fillText(output,x,y);ctx.restore()}
