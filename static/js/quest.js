import { qs, showToast } from "./helpers.js";
import {
  loadProgress, saveProgress, addResult,
  pickWeighted, masteredCount, mistakesCount,
  updateDailyStreak, grantBadges
} from "./progress.js";

const el = (id)=>qs(id);

const toast = el("#toast");
const gameBox = el("#gameBox");
const prompt = el("#prompt");
const metaLine = el("#metaLine");
const wordMask = el("#wordMask");
const input = el("#answer");

const scoreEl = el("#score");
const levelEl = el("#level");
const xpEl = el("#xp");
const streakEl = el("#streak");
const xpBar = el("#xpBar");

const modeBadge = el("#modeBadge");
const bossPill = el("#bossPill");

const masteredEl = el("#mastered");
const totalWordsEl = el("#totalWords");
const mistakesEl = el("#mistakes");
const honey = el("#honey");
const badgesEl = el("#badges");

const checkBtn = el("#checkBtn");
const repeatBtn = el("#repeatBtn");
const slowBtn = el("#slowBtn");
const definitionBtn = el("#definitionBtn");
const sentenceBtn = el("#sentenceBtn");
const hintBtn = el("#hintBtn");
const revealBtn = el("#revealBtn");

let words = [];
let score = 0;
let target = "";
let prog = null;
let username = localStorage.getItem("sb:lastUser") || "user";
let grade = 7;

// mode: all | mistakes
const urlMode = new URLSearchParams(location.search).get("mode") || "all";
modeBadge.textContent = (urlMode === "mistakes") ? "Mis errores" : "Todas";

// Boss
let correctStreakInSession = 0;
let isBoss = false;
let revealsLeft = 1;
let hintsLeft = 1;

// “Spelling Bee asks” counters
let repeatsLeft = 99;
let slowLeft = 99;
let defLeft = 2;
let sentLeft = 2;

/* ===== Safari/macOS TTS FIX: pick voice + delay ===== */
let cachedVoice = null;
function pickEnglishVoice(){
  const voices = speechSynthesis.getVoices() || [];
  return voices.find(v => /en-US/i.test(v.lang)) ||
         voices.find(v => /^en/i.test(v.lang)) ||
         voices[0] || null;
}
speechSynthesis.onvoiceschanged = () => { cachedVoice = pickEnglishVoice(); };

function speak(text, rate=1){
  if(!cachedVoice) cachedVoice = pickEnglishVoice();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  if(cachedVoice) u.voice = cachedVoice;
  u.rate = rate;
  u.pitch = 1;
  speechSynthesis.cancel();
  setTimeout(()=>speechSynthesis.speak(u), 30);
}
/* ===== end TTS FIX ===== */

function maskWord(w){
  const len = Math.max(4, Math.min(12, w.length));
  return "•".repeat(len);
}

function updateXPBar(){
  const xpInLevel = (prog.xp || 0) % 100;
  xpBar.style.width = `${Math.min(100, Math.max(0, xpInLevel))}%`;
}

function renderBadges(){
  const badges = prog.badges || {};
  const list = [
    {id:"first10", label:"🎖️ First 10 correct"},
    {id:"streak3", label:"🔥 3-day streak"},
    {id:"master20", label:"🍯 Mastered 20 words"},
  ];
  badgesEl.innerHTML = list.map(b => {
    const ok = !!badges[b.id];
    return `<div>${ok ? "✅" : "⬜"} ${b.label}</div>`;
  }).join("");
}

function renderHoney(){
  honey.innerHTML = "";
  const maxCells = Math.min(words.length, 100);

  for(let i=0;i<maxCells;i++){
    const original = words[i];
    const w = original.toLowerCase();
    const c = prog.correct?.[w] || 0;
    const wr = prog.wrong?.[w] || 0;

    const cell = document.createElement("div");
    cell.className = "hex";
    if(c >= 2) cell.classList.add("mastered");
    else if(wr > 0) cell.classList.add("mistake");

    cell.title = `${original} • correct: ${c} • wrong: ${wr}`;
    honey.appendChild(cell);
  }
}

function refreshPanels(){
  levelEl.textContent = String(prog.level);
  xpEl.textContent = String(prog.xp);
  streakEl.textContent = String(prog.streak?.count || 0);
  updateXPBar();

  totalWordsEl.textContent = String(words.length);
  masteredEl.textContent = String(masteredCount(prog));
  mistakesEl.textContent = String(mistakesCount(prog));
  renderHoney();
  renderBadges();
}

function setBoss(on){
  isBoss = on;
  bossPill.style.display = on ? "inline-flex" : "none";
  revealsLeft = on ? 2 : 1;
  hintsLeft = on ? 2 : 1;
  defLeft = on ? 3 : 2;
  sentLeft = on ? 3 : 2;
}

function pick(){
  if(correctStreakInSession > 0 && correctStreakInSession % 5 === 0) setBoss(true);
  else setBoss(false);

  target = pickWeighted(words, prog, urlMode);

  prompt.textContent = "🔊 Listen to the word";
  metaLine.textContent = `Definition (${defLeft}), Sentence (${sentLeft}), Repeat, Slow`;
  wordMask.textContent = maskWord(target);
  input.value = "";
  input.focus();

  speak(target, 1);
  refreshPanels();
}

function goodFeedback(msg){
  gameBox.classList.remove("feedbackBad","shake");
  gameBox.classList.add("feedbackGood");
  showToast(toast, msg);
  setTimeout(()=>gameBox.classList.remove("feedbackGood"), 400);
}

function badFeedback(msg){
  gameBox.classList.remove("feedbackGood");
  gameBox.classList.add("feedbackBad","shake");
  showToast(toast, msg);
  setTimeout(()=>gameBox.classList.remove("feedbackBad","shake"), 600);
}

checkBtn.addEventListener("click", ()=>{
  const ans = input.value.trim().toLowerCase();
  const ok = ans === target.toLowerCase();

  prog = addResult(prog, target, ok);
  prog = updateDailyStreak(prog);
  prog = grantBadges(prog);
  saveProgress(username, grade, prog);

  if(ok){
    score += isBoss ? 25 : 10;
    correctStreakInSession += 1;
    goodFeedback(`✅ Correct! +${isBoss ? 25 : 10} • XP ${prog.xp} • Lv ${prog.level}`);
  } else {
    correctStreakInSession = 0;
    badFeedback(`❌ Incorrect. Correct spelling: ${target}`);
  }

  scoreEl.textContent = String(score);
  pick();
});

input.addEventListener("keydown", (e)=>{
  if(e.key === "Enter") checkBtn.click();
});

repeatBtn.addEventListener("click", ()=>{
  if(!target) return;
  if(repeatsLeft <= 0){ badFeedback("No repeats left 😅"); return; }
  speak(target, 1);
});

slowBtn.addEventListener("click", ()=>{
  if(!target) return;
  if(slowLeft <= 0){ badFeedback("No slow repeats left 😅"); return; }
  // rate más bajo para que sea notorio
  speak(target, 0.60);
});

definitionBtn.addEventListener("click", ()=>{
  if(defLeft <= 0){ badFeedback("No definitions left 😅"); return; }
  defLeft -= 1;

  const w = target;
  const hint = `This word has ${w.length} letters. Try to pronounce it slowly before spelling.`;
  goodFeedback(`📘 Definition (simple): ${hint}`);
  metaLine.textContent = `Definition (${defLeft}), Sentence (${sentLeft}), Repeat, Slow`;
});

sentenceBtn.addEventListener("click", ()=>{
  if(sentLeft <= 0){ badFeedback("No sentences left 😅"); return; }
  sentLeft -= 1;

  const s = `Sentence: "I practiced the word ${target} for the spelling bee."`;
  goodFeedback(`📝 ${s}`);
  metaLine.textContent = `Definition (${defLeft}), Sentence (${sentLeft}), Repeat, Slow`;
});

hintBtn.addEventListener("click", async ()=>{
  if(hintsLeft <= 0){ badFeedback("No hints left 😅"); return; }
  hintsLeft -= 1;

  const res = await fetch("/api/hint", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({word: target})
  });
  const data = await res.json();
  if(!res.ok){
    badFeedback(`Hint error: ${data.error || "Unknown"}`);
    return;
  }
  goodFeedback(`🧠 Hint: ${data.hint}`);
});

revealBtn.addEventListener("click", ()=>{
  if(revealsLeft <= 0){ badFeedback("No reveals left 😅"); return; }
  revealsLeft -= 1;

  const w = target;
  const idxMin = (w.length > 2) ? 1 : 0;
  const idxMax = (w.length > 2) ? w.length-2 : w.length-1;
  const idx = Math.floor(Math.random() * (idxMax - idxMin + 1)) + idxMin;
  goodFeedback(`🔤 Letter #${idx+1}: "${w[idx]}"`);
});

(async ()=>{
  const r = await fetch("/api/words");
  const data = await r.json();
  if(!r.ok){
    badFeedback(`Error (${r.status}): ${data.error||"Unknown"}`);
    return;
  }

  words = data.words;
  grade = data.grade;

  prog = loadProgress(username, grade);
  prog = updateDailyStreak(prog);
  prog = grantBadges(prog);
  saveProgress(username, grade, prog);

  score = 0;
  scoreEl.textContent = "0";
  refreshPanels();
  pick();
})();
