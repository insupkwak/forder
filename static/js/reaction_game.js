(function () {
  const $ = (id) => document.getElementById(id);

  const diffSelect = $("diffSelect");
  const startBtn = $("startBtn");
  const resetBtn = $("resetBtn");
  const homeBtn = $("homeBtn");

  const stateMini = $("stateMini");
  const gridbox = $("gridbox");

  const kpiRound = $("kpiRound");
  const kpiLast = $("kpiLast");
  const kpiAvg = $("kpiAvg");
  const kpiBest = $("kpiBest");

  const statusLeft = $("statusLeft");
  const statusRight = $("statusRight");

  const history = $("history");

  const TOTAL = 10;

  // 난이도별 "10회 평균" 기록 저장
  const KEY = "reaction_grid_avg_by_diff"; // { "4":[...], "6":[...], "8":[...] }
  const loadStore = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
    catch { return {}; }
  };
  const saveStore = (obj) => localStorage.setItem(KEY, JSON.stringify(obj));

  let store = loadStore();

  // state
  let running = false;
  let waiting = false;
  let round = 0;
  let times = [];
  let targetIndex = -1;
  let startAt = 0;
  let timer = null;

  function setState(text) {
    stateMini.textContent = "상태: " + text;
  }

  function setKpis() {
    kpiRound.textContent = `${round} / ${TOTAL}`;
    const last = times.length ? times[times.length - 1] : null;
    kpiLast.textContent = last == null ? "-" : `${last} ms`;

    if (round === TOTAL) {
      const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      kpiAvg.textContent = `${avg} ms`;
    } else {
      kpiAvg.textContent = "-";
    }

    // 난이도별 최고(= 평균 기록 중 최저) 표시
    const diff = String(diffSelect.value);
    const arr = Array.isArray(store[diff]) ? store[diff] : [];
    const best = arr.length ? Math.min(...arr) : null;
    kpiBest.textContent = best == null ? "-" : `${best} ms`;
  }

  function clearTargetStyles() {
    gridbox.querySelectorAll(".cell").forEach((c) => c.classList.remove("target", "wrong"));
  }

  function buildGrid(n) {
    gridbox.innerHTML = "";
    gridbox.style.gridTemplateColumns = `repeat(${n}, 1fr)`;

    const total = n * n;
    for (let i = 0; i < total; i++) {
      const div = document.createElement("div");
      div.className = "cell";
      div.dataset.idx = String(i);
      div.addEventListener("click", onCellClick);
      gridbox.appendChild(div);
    }
  }

  function randDelay() {
    // 난이도별 랜덤 대기(조금씩 더 어려워짐)
    const n = parseInt(diffSelect.value, 10);
    if (n === 4) return 600 + Math.floor(Math.random() * 900);   // 0.6~1.5s
    if (n === 6) return 450 + Math.floor(Math.random() * 1100);  // 0.45~1.55s
    return 350 + Math.floor(Math.random() * 1300);               // 0.35~1.65s
  }

  function pickTarget(n) {
    return Math.floor(Math.random() * (n * n));
  }

  function showTarget() {
    const n = parseInt(diffSelect.value, 10);
    targetIndex = pickTarget(n);

    clearTargetStyles();
    const cell = gridbox.querySelector(`.cell[data-idx="${targetIndex}"]`);
    if (cell) cell.classList.add("target");

    startAt = performance.now();
    waiting = false;

    statusLeft.textContent = "지금! 초록색 칸을 클릭하세요.";
    setState("클릭");
  }

  function nextRound() {
    if (!running) return;

    if (round >= TOTAL) {
      finish();
      return;
    }

    waiting = true;
    clearTargetStyles();
    statusLeft.textContent = "기다리세요...";
    setState("대기");

    if (timer) clearTimeout(timer);
    timer = setTimeout(showTarget, randDelay());
  }

  function onCellClick(e) {
    if (!running) return;
    if (waiting) return; // 타겟 뜨기 전엔 무시

    const idx = parseInt(e.currentTarget.dataset.idx, 10);
    if (idx === targetIndex) {
      const ms = Math.max(0, Math.round(performance.now() - startAt));
      times.push(ms);
      round += 1;

      statusLeft.textContent = `기록: ${ms} ms`;
      setState("성공");

      setKpis();
      renderHistory();

      setTimeout(nextRound, 250);
      return;
    }

    // 오답 클릭: 패널티는 주지 않고, 시각적으로만 표시
    e.currentTarget.classList.add("wrong");
    setTimeout(() => e.currentTarget.classList.remove("wrong"), 160);
  }

  function finish() {
    running = false;
    waiting = false;
    if (timer) clearTimeout(timer);

    clearTargetStyles();
    setState("완료");

    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    statusLeft.textContent = `완료! 평균: ${avg} ms (10회)`;

    // 난이도별 평균 기록 저장
    const diff = String(diffSelect.value);
    if (!Array.isArray(store[diff])) store[diff] = [];
    store[diff].push(avg);

    // 너무 길어지면 최근 50개만 유지
    store[diff] = store[diff].slice(-50);
    saveStore(store);

    startBtn.disabled = false;
    diffSelect.disabled = false;

    setKpis();
    renderHistory(); // 평균기록 Top10 표시
  }

  function start() {
    times = [];
    round = 0;

    running = true;
    waiting = false;

    startBtn.disabled = true;
    diffSelect.disabled = true;

    const n = parseInt(diffSelect.value, 10);
    statusRight.textContent = `난이도: ${n}x${n}`;
    statusLeft.textContent = "시작! 잠시 후 초록색 칸이 나타납니다.";
    setState("시작");

    buildGrid(n);
    setKpis();
    renderHistory();

    nextRound();
  }

  function reset() {
    running = false;
    waiting = false;
    if (timer) clearTimeout(timer);

    times = [];
    round = 0;

    startBtn.disabled = false;
    diffSelect.disabled = false;

    const n = parseInt(diffSelect.value, 10);
    buildGrid(n);
    clearTargetStyles();

    statusRight.textContent = `난이도: ${n}x${n}`;
    statusLeft.textContent = "시작을 누르면 랜덤 칸이 나타납니다.";
    setState("준비");

    setKpis();
    renderHistory();
  }

  function renderHistory() {
    history.innerHTML = "";

    const diff = String(diffSelect.value);
    const arr = Array.isArray(store[diff]) ? store[diff] : [];

    if (!arr.length) {
      const div = document.createElement("div");
      div.className = "row";
      div.innerHTML = `<div class="l">기록 (난이도별 평균)</div><div class="r">아직 없음</div>`;
      history.appendChild(div);
      return;
    }

    // 평균 기록 TOP 10 (낮을수록 좋음)
    const top10 = [...arr].sort((a, b) => a - b).slice(0, 10);

    top10.forEach((ms, idx) => {
      const div = document.createElement("div");
      div.className = "row";
      div.innerHTML = `<div class="l">TOP ${idx + 1} 평균</div><div class="r">${ms} ms</div>`;
      history.appendChild(div);
    });
  }

  homeBtn.addEventListener("click", () => (window.location.href = "/"));
  startBtn.addEventListener("click", start);
  resetBtn.addEventListener("click", reset);

  diffSelect.addEventListener("change", () => reset());

  // init
  (function init() {
    const n = parseInt(diffSelect.value, 10);
    buildGrid(n);
    statusRight.textContent = `난이도: ${n}x${n}`;
    setState("준비");
    setKpis();
    renderHistory();
  })();
})();
