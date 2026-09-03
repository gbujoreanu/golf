import {
  calculateAverages,
  calculateHandicapIndex,
  formatToPar,
  scoreDifferential,
  sumHoles
} from "./calculations.js";

const STORAGE_KEY = "fairway-log-v2";
const SETTINGS_KEY = "fairway-settings-v1";
const ONBOARDING_KEY = "fairway-onboarding-v1";
const FAIRWAY_THEMES = ['classic','clubhouse','links','twilight','caddie-black'];
const DEFAULT_SETTINGS = { theme:'classic', density:'comfortable' };
const cloudClient = window.AppAuth?.client || null;

const legacyState = loadLegacyState();
let state = { courses: [], rounds: [] };
let currentUser = null;
let activeView = "dashboard";
let settings = loadSettings();
let returnToRoundAfterCourse = false;

const elements = {
  navButtons: [...document.querySelectorAll("[data-view]")],
  views: [...document.querySelectorAll("[data-view-panel]")],
  dashboardPlayer: document.getElementById("dashboardPlayer"),
  dashboardEmpty: document.getElementById("dashboardEmpty"),
  dashboardData: document.getElementById("dashboardData"),
  handicapStat: document.getElementById("handicapStat"),
  handicapDetail: document.getElementById("handicapDetail"),
  averageStat: document.getElementById("averageStat"),
  recentAverageStat: document.getElementById("recentAverageStat"),
  bestStat: document.getElementById("bestStat"),
  bestDetail: document.getElementById("bestDetail"),
  toParAverage: document.getElementById("toParAverage"),
  trendChart: document.getElementById("trendChart"),
  recentRounds: document.getElementById("recentRounds"),
  roundForm: document.getElementById("roundForm"),
  playerName: document.getElementById("playerName"),
  roundDate: document.getElementById("roundDate"),
  roundCourse: document.getElementById("roundCourse"),
  roundTee: document.getElementById("roundTee"),
  roundPcc: document.getElementById("roundPcc"),
  holeGrid: document.getElementById("holeGrid"),
  frontTotal: document.getElementById("frontTotal"),
  backTotal: document.getElementById("backTotal"),
  roundTotal: document.getElementById("roundTotal"),
  roundToPar: document.getElementById("roundToPar"),
  roundDifferential: document.getElementById("roundDifferential"),
  roundMessage: document.getElementById("roundMessage"),
  holeProgress: document.getElementById("holeProgress"),
  scoreProgress: document.getElementById("scoreProgress"),
  saveRoundButton: document.getElementById("saveRoundButton"),
  roundCourseGate: document.getElementById("roundCourseGate"),
  selectedCourseContext: document.getElementById("selectedCourseContext"),
  clearScores: document.getElementById("clearScores"),
  roundsPlayerFilter: document.getElementById("roundsPlayerFilter"),
  roundsCourseFilter: document.getElementById("roundsCourseFilter"),
  clearRoundFilters: document.getElementById("clearRoundFilters"),
  roundHistory: document.getElementById("roundHistory"),
  courseForm: document.getElementById("courseForm"),
  courseName: document.getElementById("courseName"),
  teeName: document.getElementById("teeName"),
  coursePar: document.getElementById("coursePar"),
  courseRating: document.getElementById("courseRating"),
  courseSlope: document.getElementById("courseSlope"),
  courseMessage: document.getElementById("courseMessage"),
  courseLibrary: document.getElementById("courseLibrary"),
  resetButton: document.getElementById("resetButton"),
  storageStatus: document.getElementById("storageStatus"),
  migrateButton: document.getElementById("migrateButton"),
  signOutButton: document.getElementById("signOutButton"),
  settingsTrigger: document.getElementById("settingsTrigger"),
  settingsModal: document.getElementById("settingsModal"),
  settingsEmail: document.getElementById("settingsEmail"),
  settingsCloud: document.getElementById("settingsCloud")
  ,welcomeModal: document.getElementById("welcomeModal")
};

initialize();

async function initialize() {
  applySettings();
  createHoleInputs();
  elements.roundDate.value = new Date().toISOString().slice(0, 10);
  bindEvents();
  if (!cloudClient) return redirectToLogin();
  cloudClient.auth.onAuthStateChange((_event, session) => setTimeout(async () => {
    if (session?.user && !session.user.email_confirmed_at) await cloudClient.auth.signOut();
    if (!session || !session.user.email_confirmed_at) redirectToLogin();
  }, 0));
  const { data, error } = await cloudClient.auth.getSession();
  if (error || !data.session || !data.session.user.email_confirmed_at) return redirectToLogin();
  currentUser = data.session.user;
  try {
    state = await loadCloudState();
    elements.storageStatus.textContent = `Cloud verified · ${currentUser.email || 'signed in'}`;
    elements.migrateButton.classList.toggle('hidden', !legacyState);
    document.body.classList.remove('auth-pending');
    renderAll();
    if (!hasSeenWelcome()) setTimeout(openWelcome, 250);
  } catch (loadError) {
    console.error(loadError); elements.storageStatus.textContent = 'Cloud load failed'; elements.storageStatus.classList.add('sync-error');
  }
}

function loadLegacyState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.courses) && Array.isArray(saved.rounds)) return saved;
  } catch (error) {
    console.warn("Could not read saved Fairway Log data.", error);
  }
  return null;
}

function bindEvents() {
  elements.navButtons.forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
  document.addEventListener("click", (event) => {
    const destination = event.target.closest("[data-go-to]");
    if (destination) showView(destination.dataset.goTo);
    const addCourse = event.target.closest("[data-add-course]");
    if (addCourse) { returnToRoundAfterCourse = true; showView("courses"); setTimeout(() => elements.courseName.focus(), 0); }
  });
  document.querySelectorAll("[data-view-link]").forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    showView(link.dataset.viewLink);
  }));

  elements.dashboardPlayer.addEventListener("change", renderDashboard);
  elements.roundsPlayerFilter.addEventListener("change", renderRoundHistory);
  elements.roundsCourseFilter.addEventListener("change", renderRoundHistory);
  elements.clearRoundFilters.addEventListener("click", () => {
    elements.roundsPlayerFilter.value = "all";
    elements.roundsCourseFilter.value = "all";
    renderRoundHistory();
  });

  elements.roundCourse.addEventListener("change", () => {
    renderTeeOptions();
    updateRoundSummary();
  });
  elements.roundTee.addEventListener("change", updateRoundSummary);
  elements.roundPcc.addEventListener("input", updateRoundSummary);
  elements.clearScores.addEventListener("click", () => {
    document.querySelectorAll(".hole-score").forEach((input) => { input.value = ""; });
    updateRoundSummary();
  });
  elements.roundForm.addEventListener("submit", saveRound);
  elements.roundForm.addEventListener("input", updateRoundSummary);
  elements.courseForm.addEventListener("submit", saveCourse);
  elements.courseLibrary.addEventListener("click", handleCourseAction);
  elements.roundHistory.addEventListener("click", handleRoundAction);
  elements.resetButton.addEventListener("click", resetData);
  elements.migrateButton.addEventListener("click", migrateLegacyData);
  elements.signOutButton.addEventListener("click", () => cloudClient.auth.signOut());
  elements.settingsTrigger.addEventListener('click', openSettings);
  document.getElementById('closeSettings').addEventListener('click', () => elements.settingsModal.close());
  document.querySelectorAll('[data-settings-open]').forEach((button) => button.addEventListener('click', () => showSettingsPanel(button.dataset.settingsOpen)));
  document.querySelectorAll('[data-settings-back]').forEach((button) => button.addEventListener('click', () => showSettingsPanel('main')));
  elements.settingsModal.addEventListener('close', () => showSettingsPanel('main', false));
  elements.settingsModal.addEventListener('change', saveSettingsFromControls);
  elements.holeGrid.addEventListener('click', handleScoreStep);
  elements.holeGrid.addEventListener('keydown', handleScoreKeys);
  document.getElementById('skipWelcome').addEventListener('click', dismissWelcome);
  document.getElementById('startWelcome').addEventListener('click', startWelcome);
  document.getElementById('replayWelcome').addEventListener('click', () => { elements.settingsModal.close(); openWelcome(); });
}

function hasSeenWelcome(){try{return localStorage.getItem(ONBOARDING_KEY)==='seen'}catch(error){return false}}
function openWelcome(){if(!elements.welcomeModal.open)elements.welcomeModal.showModal()}
function dismissWelcome(){try{localStorage.setItem(ONBOARDING_KEY,'seen')}catch(error){}elements.welcomeModal.close()}
function startWelcome(){dismissWelcome();showView(state.courses.length?'new-round':'courses');if(!state.courses.length)setTimeout(()=>elements.courseName.focus(),0)}

function loadSettings(){
  try{const saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');return{theme:FAIRWAY_THEMES.includes(saved.theme)?saved.theme:'classic',density:saved.density==='compact'?'compact':'comfortable'}}
  catch(error){return{...DEFAULT_SETTINGS}}
}
function applySettings(){
  document.documentElement.dataset.theme=settings.theme;document.documentElement.dataset.density=settings.density;
  const colors={classic:'#10251d',clubhouse:'#263b2f',links:'#eaf4f4',twilight:'#091722','caddie-black':'#070908'};
  const themeColor=document.getElementById('themeColor');if(themeColor)themeColor.content=colors[settings.theme]||colors.classic;
}
function showSettingsPanel(panel,moveFocus=true){
  document.querySelectorAll('[data-settings-panel]').forEach((item)=>item.classList.toggle('active',item.dataset.settingsPanel===panel));
  elements.settingsModal.dataset.panel=panel;if(moveFocus)setTimeout(()=>elements.settingsModal.querySelector(panel==='main'?'[data-settings-open]':'[data-settings-back]')?.focus(),0);
}
function openSettings(){
  elements.settingsEmail.textContent=currentUser?.email||'Signed in account';elements.settingsCloud.textContent=elements.storageStatus.textContent;
  document.querySelectorAll('input[name="fairway-theme"]').forEach((input)=>{input.checked=input.value===settings.theme});
  document.querySelectorAll('input[name="fairway-density"]').forEach((input)=>{input.checked=input.value===settings.density});
  showSettingsPanel('main',false);elements.settingsModal.showModal();setTimeout(()=>elements.settingsModal.querySelector('[data-settings-open]')?.focus(),0);
}
function saveSettingsFromControls(){
  const theme=document.querySelector('input[name="fairway-theme"]:checked')?.value||settings.theme;
  const density=document.querySelector('input[name="fairway-density"]:checked')?.value||settings.density;
  settings={theme,density};localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));applySettings();
}

function redirectToLogin() { location.replace(`${location.origin}/account/?returnTo=/golf/`); }

async function loadCloudState() {
  const [coursesResult, roundsResult] = await Promise.all([
    cloudClient.from('golf_courses').select('*').order('course'),
    cloudClient.from('golf_rounds').select('*').order('played_on')
  ]);
  const error = coursesResult.error || roundsResult.error;
  if (error) throw error;
  return { courses:coursesResult.data.map(fromCloudCourse), rounds:roundsResult.data.map(fromCloudRound) };
}
function fromCloudCourse(row){return{id:row.id,course:row.course,tee:row.tee,par:Number(row.par),rating:Number(row.rating),slope:Number(row.slope)}}
function fromCloudRound(row){return{id:row.id,player:row.player,date:row.played_on,course:row.course,tee:row.tee,par:Number(row.par),courseRating:Number(row.course_rating),slope:Number(row.slope),pcc:Number(row.pcc),holes:row.holes.map(Number),front:Number(row.front),back:Number(row.back),total:Number(row.total),differential:Number(row.differential)}}
function toCloudCourse(item){return{id:item.id,user_id:currentUser.id,course:item.course,tee:item.tee,par:Number(item.par),rating:Number(item.rating),slope:Number(item.slope)}}
function toCloudRound(item){return{id:item.id,user_id:currentUser.id,player:item.player,played_on:item.date,course:item.course,tee:item.tee,par:Number(item.par),course_rating:Number(item.courseRating),slope:Number(item.slope),pcc:Number(item.pcc)||0,holes:item.holes.map(Number),front:Number(item.front),back:Number(item.back),total:Number(item.total),differential:Number(item.differential)}}
async function saveCloud(table,row){elements.storageStatus.textContent='Saving…';const{error}=await cloudClient.from(table).upsert(row,{onConflict:'user_id,id'});if(error)throw error;elements.storageStatus.textContent=`Cloud verified · ${currentUser.email||'signed in'}`}
async function deleteCloud(table,id){const{error}=await cloudClient.from(table).delete().eq('user_id',currentUser.id).eq('id',id);if(error)throw error}

async function migrateLegacyData(){
  if(!legacyState||!confirm('Move the rounds and courses saved in this browser into your account? The browser copy will be kept as a backup.'))return;
  elements.migrateButton.disabled=true;
  try{
    const courses=legacyState.courses.map(toCloudCourse),rounds=legacyState.rounds.map(toCloudRound);
    if(courses.length){const{error}=await cloudClient.from('golf_courses').upsert(courses,{onConflict:'user_id,id'});if(error)throw error}
    if(rounds.length){const{error}=await cloudClient.from('golf_rounds').upsert(rounds,{onConflict:'user_id,id'});if(error)throw error}
    state=await loadCloudState();elements.migrateButton.classList.add('hidden');renderAll();alert('Your Golf data is now saved to your account.');
  }catch(error){console.error(error);alert('The migration did not finish. Your browser copy is still safe.');}
  finally{elements.migrateButton.disabled=false}
}

function showView(viewName) {
  activeView = viewName;
  elements.views.forEach((view) => view.classList.toggle("active", view.dataset.viewPanel === viewName));
  elements.navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === viewName));
  if (viewName === "new-round") (state.courses.length ? elements.roundCourse : document.querySelector('[data-add-course]'))?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderAll() {
  renderCourseOptions();
  renderPlayerOptions();
  renderDashboard();
  renderRoundHistory();
  renderCourseLibrary();
  renderRoundReadiness();
}

function getPlayers() {
  return [...new Set(state.rounds.map((round) => round.player).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function renderPlayerOptions() {
  const currentDashboard = elements.dashboardPlayer.value || "all";
  const currentHistory = elements.roundsPlayerFilter.value || "all";
  const options = [`<option value="all">All players</option>`, ...getPlayers().map((player) => `<option value="${escapeHtml(player)}">${escapeHtml(player)}</option>`)].join("");
  elements.dashboardPlayer.innerHTML = options;
  elements.roundsPlayerFilter.innerHTML = options;
  elements.dashboardPlayer.value = [...elements.dashboardPlayer.options].some((option) => option.value === currentDashboard) ? currentDashboard : "all";
  elements.roundsPlayerFilter.value = [...elements.roundsPlayerFilter.options].some((option) => option.value === currentHistory) ? currentHistory : "all";
}

function renderCourseOptions() {
  const courseNames = [...new Set(state.courses.map((course) => course.course))].sort((a, b) => a.localeCompare(b));
  const selectedCourse = elements.roundCourse.value;
  elements.roundCourse.innerHTML = courseNames.length
    ? `<option value="">Choose a course</option>${courseNames.map((course) => `<option value="${escapeHtml(course)}">${escapeHtml(course)}</option>`).join("")}`
    : `<option value="">Add a course first</option>`;
  if (courseNames.includes(selectedCourse)) elements.roundCourse.value = selectedCourse;
  renderTeeOptions();

  const currentFilter = elements.roundsCourseFilter.value || "all";
  elements.roundsCourseFilter.innerHTML = `<option value="all">All courses</option>${courseNames.map((course) => `<option value="${escapeHtml(course)}">${escapeHtml(course)}</option>`).join("")}`;
  elements.roundsCourseFilter.value = courseNames.includes(currentFilter) ? currentFilter : "all";
}

function renderTeeOptions() {
  const course = elements.roundCourse.value;
  const tees = state.courses.filter((item) => item.course === course);
  elements.roundTee.innerHTML = tees.length ? `<option value="">Choose a tee</option>${tees.map((item) => `<option value="${item.id}">${escapeHtml(item.tee)} tees</option>`).join("")}` : `<option value="">Choose a course first</option>`;
  renderSelectedCourseContext();
}

function renderSelectedCourseContext(){
  const tee=selectedTee();
  elements.selectedCourseContext.innerHTML=tee?`<span><small>Par</small><strong>${tee.par}</strong></span><span><small>Rating</small><strong>${tee.rating}</strong></span><span><small>Slope</small><strong>${tee.slope}</strong></span>`:`<p>Choose a course and tee to load its scoring details.</p>`;
}

function selectedTee() {
  return state.courses.find((course) => course.id === elements.roundTee.value) || null;
}

function createHoleInputs() {
  const nine=(start,label)=>`<section class="nine-card"><header><div><span>${label}</span><small>Holes ${start}–${start+8}</small></div><strong id="${start===1?'frontNineLive':'backNineLive'}">—</strong></header><div class="nine-grid">${Array.from({length:9},(_,offset)=>{const hole=start+offset;return `<div class="hole-field"><span>Hole ${hole}</span><div class="score-stepper"><button type="button" data-score-step="-1" data-hole-target="${hole}" aria-label="Decrease hole ${hole} score">−</button><input class="hole-score" data-hole="${hole}" type="number" min="1" max="20" inputmode="numeric" aria-label="Hole ${hole} score" required><button type="button" data-score-step="1" data-hole-target="${hole}" aria-label="Increase hole ${hole} score">+</button></div></div>`}).join('')}</div></section>`;
  elements.holeGrid.innerHTML=nine(1,'Front nine')+nine(10,'Back nine');
}

function handleScoreStep(event){const button=event.target.closest('[data-score-step]');if(!button)return;const input=elements.holeGrid.querySelector(`[data-hole="${button.dataset.holeTarget}"]`);const current=Number(input.value)||4;input.value=String(Math.min(20,Math.max(1,current+Number(button.dataset.scoreStep))));input.focus();updateRoundSummary()}
function handleScoreKeys(event){if(!event.target.matches('.hole-score'))return;const inputs=[...elements.holeGrid.querySelectorAll('.hole-score')];const index=inputs.indexOf(event.target);if(event.key==='Enter'||event.key==='ArrowRight'){event.preventDefault();inputs[Math.min(inputs.length-1,index+1)]?.focus()}if(event.key==='ArrowLeft'){event.preventDefault();inputs[Math.max(0,index-1)]?.focus()}}

function getHoleScores() {
  return [...document.querySelectorAll(".hole-score")].map((input) => Number(input.value) || 0);
}

function updateRoundSummary() {
  const holes = getHoleScores();
  const front = sumHoles(holes.slice(0, 9));
  const back = sumHoles(holes.slice(9));
  const total = front + back;
  const tee = selectedTee();
  const completed=holes.filter((score)=>Number.isInteger(score)&&score>0).length;
  elements.frontTotal.textContent = completed ? front : '—';
  elements.backTotal.textContent = completed > 9 ? back : '—';
  elements.roundTotal.textContent = completed ? total : '—';
  elements.roundToPar.textContent = total && tee ? formatToPar(total - tee.par) : "—";
  elements.roundDifferential.textContent = total && tee ? scoreDifferential(total, tee.rating, tee.slope, elements.roundPcc.value) : "—";
  elements.holeProgress.textContent=`${completed} / 18`;elements.scoreProgress.value=completed;
  elements.saveRoundButton.disabled=!(completed===18&&tee&&elements.playerName.value.trim()&&elements.roundDate.value);
  const frontLive=document.getElementById('frontNineLive'),backLive=document.getElementById('backNineLive');if(frontLive)frontLive.textContent=completed?front:'—';if(backLive)backLive.textContent=completed>9?back:'—';
  document.querySelectorAll('.round-steps li').forEach((step,index)=>step.classList.toggle('active',index===0&&!tee||index===1&&tee&&!elements.playerName.value.trim()||index===2&&tee&&elements.playerName.value.trim()&&completed<18||index===3&&completed===18));
}

async function saveRound(event) {
  event.preventDefault();
  const holes = getHoleScores();
  const tee = selectedTee();
  const player = elements.playerName.value.trim();
  const complete = holes.length === 18 && holes.every((score) => Number.isInteger(score) && score > 0);
  if (!tee || !player || !elements.roundDate.value || !complete) {
    showMessage(elements.roundMessage, "Complete the player, date, course, tee, and all 18 scores.", true);
    return;
  }

  const total = sumHoles(holes);
  const round = {
    id: window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    player,
    date: elements.roundDate.value,
    course: tee.course,
    tee: tee.tee,
    par: tee.par,
    courseRating: tee.rating,
    slope: tee.slope,
    pcc: Number(elements.roundPcc.value) || 0,
    holes,
    front: sumHoles(holes.slice(0, 9)),
    back: sumHoles(holes.slice(9)),
    total,
    differential: scoreDifferential(total, tee.rating, tee.slope, elements.roundPcc.value)
  };
  try { await saveCloud('golf_rounds',toCloudRound(round)); }
  catch(error) { console.error(error); showMessage(elements.roundMessage,'That round could not be saved. Please try again.',true); return; }
  state.rounds.push(round);
  elements.roundForm.reset();
  elements.playerName.value = player;
  elements.roundDate.value = new Date().toISOString().slice(0, 10);
  elements.roundPcc.value = 0;
  document.querySelectorAll(".hole-score").forEach((input) => { input.value = ""; });
  renderAll();
  updateRoundSummary();
  showView('dashboard');
}

async function saveCourse(event) {
  event.preventDefault();
  const course = elements.courseName.value.trim();
  const tee = elements.teeName.value.trim();
  const par = Number(elements.coursePar.value);
  const rating = Number(elements.courseRating.value);
  const slope = Number(elements.courseSlope.value);
  if (!course || !tee || !Number.isFinite(par) || !Number.isFinite(rating) || !Number.isFinite(slope)) return;

  const duplicate = state.courses.some((item) => item.course.toLowerCase() === course.toLowerCase() && item.tee.toLowerCase() === tee.toLowerCase());
  if (duplicate) {
    showMessage(elements.courseMessage, "That course and tee combination already exists.", true);
    return;
  }

  const savedCourse={ id:`${slugify(course)}-${slugify(tee)}-${Date.now()}`,course,tee,par,rating,slope };
  try { await saveCloud('golf_courses',toCloudCourse(savedCourse)); }
  catch(error) { console.error(error); showMessage(elements.courseMessage,'That course could not be saved. Please try again.',true); return; }
  state.courses.push(savedCourse);
  elements.courseForm.reset();
  elements.coursePar.value = 72;
  renderAll();
  showMessage(elements.courseMessage, `${course} · ${tee} saved.`);
  if(returnToRoundAfterCourse){returnToRoundAfterCourse=false;showView('new-round');elements.roundCourse.value=course;renderTeeOptions();elements.roundTee.value=savedCourse.id;renderSelectedCourseContext();updateRoundSummary()}
}

function renderDashboard() {
  const player = elements.dashboardPlayer.value || "all";
  const rounds = player === "all" ? state.rounds : state.rounds.filter((round) => round.player === player);
  const averages = calculateAverages(rounds);
  const handicap = calculateHandicapIndex(rounds);
  const hasRounds=rounds.length>0;
  elements.dashboardEmpty.hidden=hasRounds;
  elements.dashboardData.hidden=!hasRounds;
  if(!hasRounds){
    const hasCourses=state.courses.length>0;
    elements.dashboardEmpty.innerHTML=`<div class="hero-route"><span>${hasCourses?'Ready for the first tee':'Start your course book'}</span><strong>01</strong></div><div><p class="eyebrow">${hasCourses?'Your first round':'Clean slate'}</p><h1>${hasCourses?'Your scorecard is ready.':'Your next round starts here.'}</h1><p>${hasCourses?'Choose a saved course, enter 18 scores, and Fairway will begin building your history.':'Add the course and tee you actually play. Fairway never fills your account with sample golf data.'}</p><button class="button primary" type="button" data-go-to="${hasCourses?'new-round':'courses'}">${hasCourses?'Record your first round':'Add your first course'}</button></div><svg viewBox="0 0 420 260" aria-hidden="true"><path d="M10 235c92-110 161-95 222-153 55-52 99-28 178-72v225H10Z"/><path d="M151 195V50m0 10h96l-27 28 27 28h-96"/><circle cx="151" cy="200" r="11"/></svg>`;
    return;
  }
  elements.handicapStat.textContent = handicap.index ?? "—";
  elements.handicapDetail.textContent = handicap.eligible
    ? `Best ${handicap.usedCount} of latest ${handicap.totalCount}`
    : `${handicap.roundsNeeded} more rated round${handicap.roundsNeeded === 1 ? "" : "s"} needed`;
  elements.averageStat.textContent = averages.average ?? "—";
  elements.recentAverageStat.textContent = averages.recentAverage ?? "—";
  elements.bestStat.textContent = averages.best ?? "—";
  const bestRound = rounds.find((round) => Number(round.total) === averages.best);
  elements.bestDetail.textContent = bestRound ? `${bestRound.course} · ${formatDate(bestRound.date)}` : "No rounds yet";
  elements.toParAverage.textContent = averages.averageToPar === null ? "— avg to par" : `${formatToPar(averages.averageToPar)} avg to par`;
  renderTrend(rounds);
  renderRecentRounds(rounds);
}

function renderTrend(rounds) {
  const recent = [...rounds].sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-8);
  if (!recent.length) {
    elements.trendChart.innerHTML = `<div class="chart-empty"><strong>No trend yet</strong><span>Your last eight rounds will appear here.</span></div>`;
    return;
  }
  const totals = recent.map((round) => Number(round.total));
  const min = Math.min(...totals) - 2;
  const max = Math.max(...totals) + 2;
  const spread = Math.max(1, max - min);
  elements.trendChart.innerHTML = recent.map((round) => {
    const height = 20 + ((Number(round.total) - min) / spread) * 70;
    return `<div class="trend-column" title="${escapeHtml(round.course)}: ${round.total}"><span>${round.total}</span><div class="trend-bar" style="height:${height}%"></div><small>${shortDate(round.date)}</small></div>`;
  }).join("");
}

function renderRecentRounds(rounds) {
  const recent = [...rounds].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 4);
  if (!recent.length) {
    elements.recentRounds.className = "round-list empty-state";
    elements.recentRounds.innerHTML = emptyMarkup("No rounds yet", "Record your first scorecard to begin your history.", "Record a round", "new-round");
    return;
  }
  elements.recentRounds.className = "round-list";
  elements.recentRounds.innerHTML = recent.map(roundCardMarkup).join("");
}

function renderRoundHistory() {
  const player = elements.roundsPlayerFilter.value || "all";
  const course = elements.roundsCourseFilter.value || "all";
  const rounds = [...state.rounds]
    .filter((round) => player === "all" || round.player === player)
    .filter((round) => course === "all" || round.course === course)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (!rounds.length) {
    elements.roundHistory.className = "history-list empty-state";
    const anyRounds=state.rounds.length>0;
    elements.roundHistory.innerHTML = emptyMarkup(anyRounds?"No matching rounds":"No rounds recorded yet",anyRounds?"Try changing the filters.":"Your completed scorecards will appear here.",anyRounds?null:"Record your first round",anyRounds?null:"new-round");
    return;
  }
  elements.roundHistory.className = "history-list";
  elements.roundHistory.innerHTML = rounds.map((round) => `
    <article class="history-card">
      <div class="history-score"><strong>${round.total}</strong><span>${formatToPar(round.total - round.par)}</span></div>
      <div class="history-main"><h3>${escapeHtml(round.course)}</h3><p>${formatDate(round.date)} <span>·</span> ${escapeHtml(round.tee)} tees <span>·</span> ${escapeHtml(round.player)}</p></div>
      <div class="history-metrics"><span><small>Differential</small><strong>${round.differential ?? scoreDifferential(round.total, round.courseRating, round.slope, round.pcc)}</strong></span><span><small>Rating / slope</small><strong>${round.courseRating} / ${round.slope}</strong></span></div>
      <button class="icon-button danger" type="button" data-delete-round="${round.id}" aria-label="Delete ${escapeHtml(round.course)} round">Delete</button>
    </article>
  `).join("");
}

function roundCardMarkup(round) {
  return `<article class="round-row"><div class="round-score"><strong>${round.total}</strong><span>${formatToPar(round.total - round.par)}</span></div><div><h3>${escapeHtml(round.course)}</h3><p>${escapeHtml(round.player)} · ${escapeHtml(round.tee)} · ${formatDate(round.date)}</p></div><div class="round-diff"><small>Differential</small><strong>${round.differential ?? scoreDifferential(round.total, round.courseRating, round.slope, round.pcc)}</strong></div></article>`;
}

function renderCourseLibrary() {
  const groups = Object.groupBy
    ? Object.groupBy(state.courses, (item) => item.course)
    : state.courses.reduce((result, item) => ({ ...result, [item.course]: [...(result[item.course] || []), item] }), {});
  if (!state.courses.length) {
    elements.courseLibrary.innerHTML = emptyMarkup("No courses yet", "Add a course once and reuse its tee information whenever you play.");
    return;
  }
  elements.courseLibrary.innerHTML = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([course, tees]) => `
    <section class="course-group"><header><div><span>Course</span><h3>${escapeHtml(course)}</h3></div><small>${tees.length} saved tee${tees.length===1?'':'s'}</small></header>${tees.map((tee) => `
      <div class="tee-row"><div><strong>${escapeHtml(tee.tee)}</strong><span>Par ${tee.par}</span></div><div class="tee-ratings"><span><small>Rating</small>${tee.rating}</span><span><small>Slope</small>${tee.slope}</span></div><button class="icon-button danger" type="button" data-delete-course="${tee.id}" aria-label="Delete ${escapeHtml(course)} ${escapeHtml(tee.tee)} tee">Delete</button></div>
    `).join("")}</section>
  `).join("");
}

async function handleCourseAction(event) {
  const button = event.target.closest("[data-delete-course]");
  if (!button) return;
  const id = button.dataset.deleteCourse;
  const tee = state.courses.find((course) => course.id === id);
  if (!tee || !confirm(`Delete ${tee.course} · ${tee.tee}? Existing rounds will keep their saved ratings.`)) return;
  try { await deleteCloud('golf_courses',id); }
  catch(error) { console.error(error); alert('That course could not be deleted.'); return; }
  state.courses = state.courses.filter((course) => course.id !== id);
  renderAll();
}

async function handleRoundAction(event) {
  const button = event.target.closest("[data-delete-round]");
  if (!button) return;
  const round = state.rounds.find((item) => item.id === button.dataset.deleteRound);
  if (!round || !confirm(`Delete the ${round.total} at ${round.course}?`)) return;
  try { await deleteCloud('golf_rounds',round.id); }
  catch(error) { console.error(error); alert('That round could not be deleted.'); return; }
  state.rounds = state.rounds.filter((item) => item.id !== round.id);
  renderAll();
}

async function resetData() {
  if (!confirm("Permanently reset every round and course in your cloud account? This cannot be undone.")) return;
  try{
    for(const table of ['golf_rounds','golf_courses']){const{error}=await cloudClient.from(table).delete().eq('user_id',currentUser.id);if(error)throw error}
    state={courses:[],rounds:[]};renderAll();showView('dashboard');
  }catch(error){console.error(error);alert('Your account data could not be reset.');}
}

function showMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function renderRoundReadiness(){
  const hasCourses=state.courses.length>0;
  elements.roundCourseGate.hidden=hasCourses;
  elements.roundForm.hidden=!hasCourses;
  if(!hasCourses)elements.roundCourseGate.innerHTML=`<svg viewBox="0 0 48 48" aria-hidden="true"><use href="#icon-course"/></svg><p class="eyebrow">Course required</p><h2>Add a course before recording a round.</h2><p>Fairway uses its par, Course Rating, and Slope Rating to calculate your score and differential correctly.</p><button class="button primary" type="button" data-add-course>Add your first course</button>`;
  updateRoundSummary();
}

function emptyMarkup(title, copy, actionLabel=null, destination=null) {
  return `<div class="empty-content"><svg viewBox="0 0 48 48" aria-hidden="true"><use href="#icon-course"/></svg><strong>${title}</strong><p>${copy}</p>${actionLabel?`<button class="button primary" type="button" data-go-to="${destination}">${actionLabel}</button>`:''}</div>`;
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function formatDate(value) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function shortDate(value) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}
