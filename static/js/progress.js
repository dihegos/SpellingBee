export function getKey(username, grade){
  return `sb:${username}:g${grade}`;
}

export function getTodayKey(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

export function getDateKeyNDaysAgo(n){
  const d = new Date();
  d.setDate(d.getDate()-n);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

export function loadProgress(username, grade){
  const key = getKey(username, grade);
  const raw = localStorage.getItem(key);
  if(raw){
    try { return JSON.parse(raw); } catch(e) {}
  }
  return {
    xp: 0,
    level: 1,
    correct: {},          // word -> count total correct
    wrong: {},            // word -> count total wrong
    streak: { lastDay: null, count: 0 },
    bestStreak: 0,
    badges: {},           // badgeId -> true
    xpLog: {}             // "YYYY-MM-DD" -> xp earned that day
  };
}

export function saveProgress(username, grade, prog){
  localStorage.setItem(getKey(username, grade), JSON.stringify(prog));
}

export function updateDailyStreak(prog){
  const today = getTodayKey();
  const yesterday = getDateKeyNDaysAgo(1);

  if(prog.streak?.lastDay === today) return prog;

  if(prog.streak?.lastDay === yesterday){
    prog.streak.count = (prog.streak.count || 0) + 1;
  } else {
    prog.streak.count = 1;
  }
  prog.streak.lastDay = today;
  prog.bestStreak = Math.max(prog.bestStreak || 0, prog.streak.count || 0);
  return prog;
}

export function addResult(prog, word, isCorrect){
  const w = word.toLowerCase();
  let deltaXP = 0;

  if(isCorrect){
    prog.correct[w] = (prog.correct[w] || 0) + 1;
    deltaXP = 10;
    prog.xp = (prog.xp || 0) + deltaXP;
  } else {
    prog.wrong[w] = (prog.wrong[w] || 0) + 1;
  }

  // xp log por día
  if(!prog.xpLog) prog.xpLog = {};
  const today = getTodayKey();
  prog.xpLog[today] = (prog.xpLog[today] || 0) + deltaXP;

  // level up: cada 100 XP
  prog.level = Math.floor((prog.xp || 0) / 100) + 1;
  return prog;
}

export function weightForWord(prog, word){
  const w = word.toLowerCase();
  const wrong = prog.wrong?.[w] || 0;
  const correct = prog.correct?.[w] || 0;
  const masteryPenalty = Math.max(0, 2 - correct);
  return 1 + wrong * 3 + masteryPenalty;
}

export function pickWeighted(words, prog, mode="all"){
  const pool = mode === "mistakes"
    ? words.filter(w => (prog.wrong?.[w.toLowerCase()] || 0) > 0)
    : words.slice();

  const usable = pool.length ? pool : words;
  const weights = usable.map(w => weightForWord(prog, w));
  const sum = weights.reduce((a,b)=>a+b,0);
  let r = Math.random() * sum;

  for(let i=0;i<usable.length;i++){
    r -= weights[i];
    if(r <= 0) return usable[i];
  }
  return usable[usable.length-1];
}

export function masteredCount(prog){
  return Object.keys(prog.correct || {}).filter(w => (prog.correct[w] || 0) >= 2).length;
}

export function mistakesCount(prog){
  return Object.keys(prog.wrong || {}).filter(w => (prog.wrong[w] || 0) > 0).length;
}

export function grantBadges(prog){
  const badges = prog.badges || (prog.badges = {});
  const totalCorrect = Object.values(prog.correct || {}).reduce((a,b)=>a+b,0);

  if(totalCorrect >= 10) badges["first10"] = true;
  if((prog.streak?.count || 0) >= 3) badges["streak3"] = true;
  if(masteredCount(prog) >= 20) badges["master20"] = true;

  prog.badges = badges;
  return prog;
}

export function getLast7DaysXP(prog){
  const out = [];
  for(let i=6;i>=0;i--){
    const k = getDateKeyNDaysAgo(i);
    out.push({ dayKey: k, xp: prog.xpLog?.[k] || 0 });
  }
  return out;
}
