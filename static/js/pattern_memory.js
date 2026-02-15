(function () {
  const $ = (id) => document.getElementById(id);

  const diffSelect = $("diffSelect");
  const startBtn = $("startBtn");
  const restartBtn = $("restartBtn");
  const homeBtn = $("homeBtn");

  const stateMini = $("stateMini");
  const kpiRound = $("kpiRound");
  const kpiWin = $("kpiWin");
  const kpiStep = $("kpiStep");
  const kpiTime = $("kpiTime");

  const board = $("board");
  const dotsEl = $("dots");
  const svg = $("svg");
  const statusLeft = $("statusLeft");
  const statusRight = $("statusRight");
  const history = $("history");

  const SHOW_MS = 3000;
  const TOTAL_ROUNDS = 10;
  const KEY_PREFIX = "pattern_memory_best10_";

  let n = 4;              // grid size
  let patternLen = 8;     // 3x3=5, 4x4=8, 5x5=12
  let phase = "idle";     // idle | show | input | done

  let round = 0;
  let wins = 0;

  let target = [];        // [idx...]
  let input = [];         // [idx...]
  let showTimer = 0;

  let startAt = 0;
  let raf = 0;

  let scores = [];

  // ---- utils
  function setState(s){ stateMini.textContent = "상태: " + s; }
  function nowMs(){ return Math.round(performance.now()); }
  function fmt1(ms){ return (ms/1000).toFixed(1); }
  function key(){ return KEY_PREFIX + String(n); }

  function loadScores(){
    try { return JSON.parse(localStorage.getItem(key()) || "[]"); }
    catch { return []; }
  }
  function saveScores(arr){
    localStorage.setItem(key(), JSON.stringify(arr));
  }

  function parseDiff(){
    n = parseInt(diffSelect.value, 10);
    patternLen = (n === 3) ? 5 : (n === 4) ? 8 : 12;
  }

  function idxToRC(idx){
    const r = Math.floor(idx / n);
    const c = idx % n;
    return [r, c];
  }

  function isAdjacent(a, b){
    const [ar, ac] = idxToRC(a);
    const [br, bc] = idxToRC(b);
    const dr = Math.abs(ar - br);
    const dc = Math.abs(ac - bc);
    return (dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0));
  }

  function shuffle(arr){
    for (let i = arr.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function dotCenter(el){
    const b = board.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const x = (r.left + r.right)/2 - b.left;
    const y = (r.top + r.bottom)/2 - b.top;
    return [x, y];
  }

  function clearSvg(){
    svg.innerHTML = "";
  }

  function drawLinePath(indices, klass){
    clearSvg();
    if (indices.length < 2) return;

    const pts = indices.map(i => {
      const el = dotsEl.querySelector(`[data-idx="${i}"]`);
      return dotCenter(el);
    });

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const d = pts.map((p, i) => `${i===0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-width", "10");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("opacity", "0.95");
    path.setAttribute("stroke", klass === "bad" ? "rgba(231,76,60,0.75)" : "rgba(46,204,113,0.75)");
    svg.appendChild(path);
  }

  function setDotsActive(indices, bad=false){
    dotsEl.querySelectorAll(".dot").forEach(d => d.classList.remove("active", "bad"));
    indices.forEach(i => {
      const el = dotsEl.querySelector(`[data-idx="${i}"]`);
      if (!el) return;
      el.classList.add(bad ? "bad" : "active");
    });
  }

  function updateKpis(){
    kpiRound.textContent = `${round} / ${TOTAL_ROUNDS}`;
    kpiWin.textContent = String(wins);
    kpiStep.textContent = `${input.length} / ${patternLen}`;
  }

  function renderHistory(){
    history.innerHTML = "";
    if (!scores.length){
      const div = document.createElement("div");
      div.className = "row";
      div.innerHTML = `<div class="l">기록</div><div class="r">아직 없음</div>`;
      history.appendChild(div);
      return;
    }
    scores.forEach((s, i) => {
      const div = document.createElement("div");
      div.className = "row";
      div.innerHTML = `<div class="l">TOP ${i+1} · ${s.at}</div><div class="r">${s.wins}/10 · ${fmt1(s.time_ms)} s</div>`;
      history.appendChild(div);
    });
  }

  function loadAndShowBest(){
    scores = loadScores();
    renderHistory();
  }

  function buildDots(){
    dotsEl.innerHTML = "";
    dotsEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;

    const total = n*n;
    for (let i=0; i<total; i++){
      const d = document.createElement("div");
      d.className = "dot";
      d.dataset.idx = String(i);
      d.addEventListener("pointerdown", onPickDot);
      dotsEl.appendChild(d);
    }
  }

  function genPattern(){
    // 인접 이동만, 중복 없음
    const total = n*n;
    const all = Array.from({length: total}, (_, i) => i);
    const start = all[Math.floor(Math.random() * total)];

    const path = [start];
    const used = new Set([start]);

    while (path.length < patternLen){
      const cur = path[path.length - 1];
      const candidates = [];
      for (let i=0; i<total; i++){
        if (used.has(i)) continue;
        if (isAdjacent(cur, i)) candidates.push(i);
      }
      if (!candidates.length){
        // 막혔으면 재시도
        return genPattern();
      }
      const nxt = candidates[Math.floor(Math.random() * candidates.length)];
      path.push(nxt);
      used.add(nxt);
    }
    return path;
  }

  function tick(){
    if (phase !== "show" && phase !== "input") return;
    const ms = Math.max(0, nowMs() - startAt);
    kpiTime.textContent = `${fmt1(ms)} s`;
    raf = requestAnimationFrame(tick);
  }

  function startGame(){
    parseDiff();
    buildDots();
    clearSvg();

    round = 0;
    wins = 0;
    input = [];
    target = [];
    phase = "idle";

    diffSelect.disabled = true;
    startBtn.disabled = true;

    statusLeft.textContent = "곧 시작합니다.";
    setState("시작");
    updateKpis();

    startAt = nowMs();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);

    nextRound();
  }

  function nextRound(){
    round += 1;
    input = [];
    target = genPattern();

    updateKpis();
    setState("암기");
    phase = "show";

    statusLeft.textContent = `라운드 ${round}: 패턴을 3초 동안 외우세요!`;
    setDotsActive(target, false);
    markStartEnd();    
    drawLinePath(target, "ok");

    clearTimeout(showTimer);
    showTimer = setTimeout(() => {
      // 입력 시작
      setState("입력");
      phase = "input";
      statusLeft.textContent = "같은 순서로 점을 눌러 입력하세요.";
      setDotsActive([], false);
      clearTags(); 
      clearSvg();
      updateKpis();
    }, SHOW_MS);
  }

  function endGame(msg){
    clearTimeout(showTimer);
    cancelAnimationFrame(raf);
    phase = "done";
    setState("완료");

    diffSelect.disabled = false;
    startBtn.disabled = false;
    startBtn.textContent = "다시 시작";

    const time_ms = Math.max(0, nowMs() - startAt);
    statusLeft.textContent = `${msg}  결과: ${wins}/10 · ${fmt1(time_ms)} s`;

    const at = new Date().toLocaleString();
    scores = loadScores();
    scores.push({ wins, time_ms, at });

    // 정렬: 성공 횟수 desc, 시간 asc
    scores.sort((a, b) => {
      if (a.wins !== b.wins) return b.wins - a.wins;
      return a.time_ms - b.time_ms;
    });
    scores = scores.slice(0, 10);
    saveScores(scores);
    renderHistory();
  }

  function markWrong(){
    // 입력이 틀리면 라운드 실패 처리 후 다음 라운드 진행
    setDotsActive(input, true);
    drawLinePath(input, "bad");
    statusLeft.textContent = "틀렸습니다! 다음 라운드로...";
    phase = "show"; // 입력 잠깐 막기

    setTimeout(() => {
      if (round >= TOTAL_ROUNDS){
        endGame("게임 종료.");
      } else {
        nextRound();
      }
    }, 600);
  }

  function markCorrectAndContinue(){
    if (input.length === patternLen){
      wins += 1;
      updateKpis();

      setDotsActive(target, false);
      drawLinePath(target, "ok");
      statusLeft.textContent = "정답! 다음 라운드로...";
      phase = "show";

      setTimeout(() => {
        if (wins >= TOTAL_ROUNDS){
          endGame("10회 성공! 클리어!");
          return;
        }
        if (round >= TOTAL_ROUNDS){
          endGame("게임 종료.");
        } else {
          nextRound();
        }
      }, 600);
    }
  }




  function onPickDot(e){
    if (phase !== "input") return;

    const idx = parseInt(e.currentTarget.dataset.idx, 10);

    // 중복 선택 금지
    if (input.includes(idx)) return;

    // 첫 점은 아무거나 가능(하지만 정답은 target[0]이어야 하므로 즉시 체크)
    input.push(idx);
    setDotsActive(input, false);
    drawLinePath(input, "ok");
    updateKpis();

    const pos = input.length - 1;

    // 1) 정답 순서 체크
    if (idx !== target[pos]){
      markWrong();
      return;
    }

    // 2) 인접 규칙 체크(입력 자체가 인접이어야 함)
    if (pos > 0 && !isAdjacent(input[pos-1], input[pos])){
      markWrong();
      return;
    }

    // 다 맞췄는지
    markCorrectAndContinue();
  }

  function restart(){
  clearTimeout(showTimer);
  cancelAnimationFrame(raf);

  phase = "idle";            // ✅ 중요: 상태 복구
  round = 0;
  wins = 0;
  input = [];
  target = [];

  parseDiff();
  buildDots();
  clearSvg();
  setDotsActive([], false);

  diffSelect.disabled = false;
  startBtn.disabled = false;
  startBtn.textContent = "시작";

  kpiTime.textContent = "0.0 s";
  updateKpis();

  setState("준비");
  statusLeft.textContent = "시작을 누르면 패턴이 3초간 표시됩니다.";
}




function clearTags(){
  dotsEl.querySelectorAll(".dot").forEach(d => {
    d.classList.remove("start", "end");
    const tag = d.querySelector(".tag");
    if (tag) tag.remove();
  });
}

function markStartEnd(){
  clearTags();
  if (!target.length) return;

  const sIdx = target[0];
  const eIdx = target[target.length - 1];

  const sEl = dotsEl.querySelector(`[data-idx="${sIdx}"]`);
  const eEl = dotsEl.querySelector(`[data-idx="${eIdx}"]`);

  if (sEl){
    sEl.classList.add("start");
    const t = document.createElement("div");
    t.className = "tag";
    t.textContent = "S";
    sEl.appendChild(t);
  }

  if (eEl){
    eEl.classList.add("end");
    const t = document.createElement("div");
    t.className = "tag";
    t.textContent = "E";
    eEl.appendChild(t);
  }
}


startBtn.addEventListener("click", () => {
  if (phase === "show" || phase === "input") return;
  startGame();
});

  restartBtn.addEventListener("click", restart);
  homeBtn.addEventListener("click", () => (window.location.href = "/"));

  diffSelect.addEventListener("change", () => {
    if (phase === "show" || phase === "input") return;
    restart();
    loadAndShowBest();
  });

  // init
  (function init(){
    parseDiff();
    buildDots();
    loadAndShowBest();
    updateKpis();
    kpiTime.textContent = "0.0 s";
    setState("준비");
    statusLeft.textContent = "시작을 누르면 패턴이 3초간 표시됩니다.";
  })();
})();
