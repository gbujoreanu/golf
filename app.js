import {
  calculateAverages,
  calculateHandicapIndex,
  courseHandicap,
  formatToPar,
  scoreDifferential,
  sumHoles
} from "./calculations.js";

const STORAGE_KEY = "fairway-log-v2";
const SETTINGS_KEY = "fairway-settings-v1";
const FAIRWAY_THEMES = ['classic','clubhouse','links','twilight','caddie-black'];
const DEFAULT_SETTINGS = { theme:'classic', density:'comfortable' };
const cloudClient = window.AppAuth?.client || null;
const defaultCourses = [
  { id: "charwood-green", course: "Charwood", tee: "Green", par: 72, rating: 67.8, slope: 126 },
  { id: "charwood-red", course: "Charwood", tee: "Red", par: 72, rating: 69.7, slope: 129 },
  { id: "spur-blue", course: "Spur at Northwoods", tee: "Blue", par: 72, rating: 71.9, slope: 122 }
];

const legacyState = loadLegacyState();
let state = { courses: [], rounds: [] };
let currentUser = null;
let activeView = "dashboard";
let settings = loadSettings();

const elements = {
  navButtons: [...document.querySelectorAll("[data-view]")],
  views: [...document.querySelectorAll("[data-view-panel]")],
  dashboardPlayer: document.getElementById("dashboardPlayer"),
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
    if (!state.courses.length) {
      const rows = defaultCourses.map(toCloudCourse);
      const { error: seedError } = await cloudClient.from('golf_courses').upsert(rows, { onConflict:'user_id,id' });
      if (seedError) throw seedError;
      state.courses = defaultCourses.map((course) => ({ ...course }));
    }
    elements.storageStatus.textContent = `Cloud verified · ${currentUser.email || 'signed in'}`;
    elements.migrateButton.classList.toggle('hidden', !legacyState);
    document.body.classList.remove('auth-pending');
    renderAll();
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
  document.querySelectorAll("[data-go-to]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.goTo)));
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
}

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
  if (viewName === "new-round") elements.playerName.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderAll() {
  renderCourseOptions();
  renderPlayerOptions();
  renderDashboard();
  renderRoundHistory();
  renderCourseLibrary();
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
    ? courseNames.map((course) => `<option value="${escapeHtml(course)}">${escapeHtml(course)}</option>`).join("")
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
  elements.roundTee.innerHTML = tees.map((item) => `<option value="${item.id}">${escapeHtml(item.tee)} · ${item.rating}/${item.slope}</option>`).join("");
}

function selectedTee() {
  return state.courses.find((course) => course.id === elements.roundTee.value) || null;
}

function createHoleInputs() {
  elements.holeGrid.innerHTML = Array.from({ length: 18 }, (_, index) => `
    <label class="hole-field">
      <span>Hole ${index + 1}</span>
      <input class="hole-score" data-hole="${index + 1}" type="number" min="1" max="20" inputmode="numeric" aria-label="Hole ${index + 1} score" required>
    </label>
  `).join("");
  elements.holeGrid.addEventListener("input", updateRoundSummary);
}

function getHoleScores() {
  return [...document.querySelectorAll(".hole-score")].map((input) => Number(input.value) || 0);
}

function updateRoundSummary() {
  const holes = getHoleScores();
  const front = sumHoles(holes.slice(0, 9));
  const back = sumHoles(holes.slice(9));
  const total = front + back;
  const tee = selectedTee();
  elements.frontTotal.textContent = front;
  elements.backTotal.textContent = back;
  elements.roundTotal.textContent = total;
  elements.roundToPar.textContent = total && tee ? formatToPar(total - tee.par) : "—";
  elements.roundDifferential.textContent = total && tee ? scoreDifferential(total, tee.rating, tee.slope, elements.roundPcc.value) : "—";
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
  showMessage(elements.roundMessage, `Saved ${player}'s ${total} at ${tee.course}.`);
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
}

function renderDashboard() {
  const player = elements.dashboardPlayer.value || "all";
  const rounds = player === "all" ? state.rounds : state.rounds.filter((round) => round.player === player);
  const averages = calculateAverages(rounds);
  const handicap = calculateHandicapIndex(rounds);
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
    elements.recentRounds.innerHTML = emptyMarkup("No rounds yet", "Add your first scorecard to start building a trend.");
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
    elements.roundHistory.innerHTML = emptyMarkup("No matching rounds", "Add a round or change the filters.");
    return;
  }
  elements.roundHistory.className = "history-list";
  elements.roundHistory.innerHTML = rounds.map((round) => `
    <article class="history-card">
      <div class="history-score"><strong>${round.total}</strong><span>${formatToPar(round.total - round.par)}</span></div>
      <div class="history-main"><h3>${escapeHtml(round.course)}</h3><p>${escapeHtml(round.player)} · ${escapeHtml(round.tee)} tees · ${formatDate(round.date)}</p></div>
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
    elements.courseLibrary.innerHTML = emptyMarkup("No courses saved", "Add a course and tee to start tracking rounds.");
    return;
  }
  elements.courseLibrary.innerHTML = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([course, tees]) => `
    <section class="course-group"><h3>${escapeHtml(course)}</h3>${tees.map((tee) => `
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
    const courses=defaultCourses.map(toCloudCourse);const{error}=await cloudClient.from('golf_courses').insert(courses);if(error)throw error;
    state={courses:defaultCourses.map((course)=>({...course})),rounds:[]};renderAll();showView('dashboard');
  }catch(error){console.error(error);alert('Your account data could not be reset.');}
}

function showMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function emptyMarkup(title, copy) {
  return `<div class="empty-content"><span aria-hidden="true">⛳</span><strong>${title}</strong><p>${copy}</p></div>`;
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
