(function () {
  const $ = (id) => document.getElementById(id);

  const diffSelect = $("diffSelect");
  const startBtn = $("startBtn");
  const homeBtn = $("homeBtn");

  const stateMini = $("stateMini");

  const kpiNext = $("kpiNext");
  const kpiProg = $("kpiProg");
  const kpiTime = $("kpiTime");
  const kpiBest = $("kpiBest");

  const gridbox = $("gridbox");
  const statusLeft = $("statusLeft");
  const statusRight = $("statusRight");
  const history = $("history");

  const KEY_PREFIX = "number_order_best10_"; // difficulty별 저장

  let running = false;
  let rows = 4;
  let cols = 4;
  let total = 16;
  let nextNum = 1;

  let startAt = 0;
  let raf = 0;

  function setState(s) {
    stateMini.textContent = "상태: " + s;
  }

  function diffKey() {
    return KEY_PREFIX + `${rows}x${cols}`;
  }

  function loadScores() {
    try { return JSON.parse(localStorage.getItem(diffKey()) || "[]"); }
    catch { return []; }
  }

  function saveScores(arr) {
    localStorage.setItem(diffKey(), JSON.stringify(arr));
  }

  let scores = [];

  function fmtMs(ms) {
    return (ms / 1000).toFixed(3);
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function parseDiff() {
    const v = String(diffSelect.value || "4x4");
    const [r, c] = v.split("x").map((x) => parseInt(x, 10));
    rows = r;
    cols = c;
    total = rows * cols;
  }

  function renderKpis() {
    kpiNext.textContent = String(nextNum);
    kpiProg.textContent = `${Math.max(0, nextNum - 1)} / ${total}`;
  }

  function renderBest() {
    const best = scores.length ? Math.min(...scores.map(s => s.ms)) : null;
    kpiBest.textContent = best == null ? "-" : `${fmtMs(best)} s`;
  }

  function renderHistory() {
    history.innerHTML = "";
    if (!scores.length) {
      const div = document.createElement("div");
      div.className = "row";
      div.innerHTML = `<div class="l">기록</div><div class="r">아직 없음</div>`;
      history.appendChild(div);
      return;
    }

    scores.forEach((s, i) => {
      const div = document.createElement("div");
      div.className = "row";
      div.innerHTML = `<div class="l">TOP ${i + 1} · ${s.at}</div><div class="r">${fmtMs(s.ms)} s</div>`;
      history.appendChild(div);
    });
  }

  function tick() {
    if (!running) return;
    const ms = Math.max(0, Math.round(performance.now() - startAt));
    kpiTime.textContent = `${fmtMs(ms)} s`;
    raf = requestAnimationFrame(tick);
  }

  function buildGrid() {
    gridbox.innerHTML = "";
    gridbox.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    const nums = shuffle(Array.from({ length: total }, (_, i) => i + 1));

    nums.forEach((n) => {
      const div = document.createElement("div");
      div.className = "cell";
      div.textContent = String(n);
      div.dataset.num = String(n);
      div.addEventListener("click", onCellClick);
      gridbox.appendChild(div);
    });
  }

  function start() {
    parseDiff();
    scores = loadScores();

    running = true;
    nextNum = 1;
    kpiTime.textContent = "0.000 s";

    statusRight.textContent = `난이도: ${rows}x${cols}`;
    statusLeft.textContent = "1부터 순서대로 누르세요.";
    setState("진행");

    diffSelect.disabled = true;
    startBtn.disabled = true;

    buildGrid();
    renderKpis();
    renderBest();
    renderHistory();

    startAt = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function finish() {
    running = false;
    cancelAnimationFrame(raf);

    const ms = Math.max(0, Math.round(performance.now() - startAt));
    statusLeft.textContent = `완료! 기록: ${fmtMs(ms)} s`;
    setState("완료");

    diffSelect.disabled = false;
    startBtn.disabled = false;
    startBtn.textContent = "다시 시작";

    const at = new Date().toLocaleString();
    scores.push({ ms, at });
    scores.sort((a, b) => a.ms - b.ms);
    scores = scores.slice(0, 10);
    saveScores(scores);

    renderBest();
    renderHistory();
  }

  function onCellClick(e) {
    if (!running) return;

    const cell = e.currentTarget;
    if (cell.classList.contains("done")) return;

    const n = parseInt(cell.dataset.num, 10);

    if (n === nextNum) {
      cell.classList.add("good");
      cell.classList.add("done");
      setTimeout(() => cell.classList.remove("good"), 140);

      nextNum += 1;
      renderKpis();

      if (nextNum > total) {
        finish();
      }
      return;
    }

    // 틀린 숫자 클릭
    cell.classList.add("bad");
    setTimeout(() => cell.classList.remove("bad"), 160);
  }

  diffSelect.addEventListener("change", () => {
    parseDiff();
    scores = loadScores();
    statusRight.textContent = `난이도: ${rows}x${cols}`;
    statusLeft.textContent = "시작을 누르면 숫자가 섞여서 배치됩니다.";
    startBtn.textContent = "시작";
    setState("준비");
    nextNum = 1;
    kpiTime.textContent = "0.000 s";
    buildGrid();
    renderKpis();
    renderBest();
    renderHistory();
  });

  startBtn.addEventListener("click", () => {
    if (!running) start();
  });

  homeBtn.addEventListener("click", () => (window.location.href = "/"));

  // init
  (function init() {
    parseDiff();
    scores = loadScores();
    statusRight.textContent = `난이도: ${rows}x${cols}`;
    setState("준비");
    buildGrid();
    renderKpis();
    renderBest();
    renderHistory();
  })();
})();
