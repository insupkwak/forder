(function () {
  const $ = (id) => document.getElementById(id);

  const diffSelect = $("diffSelect");
  const startBtn = $("startBtn");
  const homeBtn = $("homeBtn");

  const stateMini = $("stateMini");

  const kpiNext = $("kpiNext");
  const kpiHit = $("kpiHit");
  const kpiTime = $("kpiTime");
  const kpiBest = $("kpiBest");

  const gridbox = $("gridbox");
  const statusLeft = $("statusLeft");
  const statusRight = $("statusRight");
  const history = $("history");
  const restartBtn = $("restartBtn");


  const SHOW_MS = 5000;
  const KEY_PREFIX = "memory_numbers_best10_"; // difficulty별

  let n = 4;
  let total = 16;

  let phase = "idle"; // idle | show | play | done
  let nextNum = 1;
  let hit = 0;

  let startAt = 0;
  let raf = 0;
  let revealTimer = 0;

  let scores = [];

function fmt1(ms) {
  return (ms / 1000).toFixed(1);
}



  function setState(s) {
    stateMini.textContent = "상태: " + s;
  }

  function key() {
    return KEY_PREFIX + String(n);
  }

  function loadScores() {
    try { return JSON.parse(localStorage.getItem(key()) || "[]"); }
    catch { return []; }
  }

  function saveScores(arr) {
    localStorage.setItem(key(), JSON.stringify(arr));
  }

  function fmt(ms) {
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
    n = parseInt(diffSelect.value, 10);
    total = n * n;
    statusRight.textContent = `난이도: ${n}x${n}`;
  }

  function renderKpis() {
    kpiNext.textContent = String(nextNum);
    kpiHit.textContent = String(hit);
  }

  function renderBest() {
    const best = scores.length ? scores[0] : null;
    if (!best) {
      kpiBest.textContent = "-";
      return;
    }
    if (best.completed) {
      kpiBest.textContent = `${fmt1(best.time_ms)} s`;

    } else {
      kpiBest.textContent = `${best.hit}/${total} (미완주)`;
    }
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
      const label = s.completed
        ? `완주 · ${fmt(s.time_ms)} s`
        : `미완주 · ${s.hit}/${total} · ${fmt(s.time_ms)} s`;

      const div = document.createElement("div");
      div.className = "row";
      div.innerHTML = `<div class="l">TOP ${i + 1} · ${s.at}</div><div class="r">${label}</div>`;
      history.appendChild(div);
    });
  }

  function buildGrid() {
    gridbox.innerHTML = "";
    gridbox.style.gridTemplateColumns = `repeat(${n}, 1fr)`;

    const nums = shuffle(Array.from({ length: total }, (_, i) => i + 1));
    nums.forEach((num) => {
      const div = document.createElement("div");
      div.className = "cell";
      div.textContent = String(num);
      div.dataset.num = String(num);
      div.addEventListener("click", onCellClick);
      gridbox.appendChild(div);
    });
  }

  function setHidden(isHidden) {
    gridbox.querySelectorAll(".cell").forEach((c) => {
      if (isHidden) c.classList.add("hidden");
      else c.classList.remove("hidden");
    });
  }

  function tick() {
    if (phase !== "play") return;
    const ms = Math.max(0, Math.round(performance.now() - startAt));
    kpiTime.textContent = fmt(ms); // "0.000"만 표시
    raf = requestAnimationFrame(tick);
  }

  function start() {
    parseDiff();
    scores = loadScores();

    phase = "show";
    nextNum = 1;
    hit = 0;
    kpiTime.textContent = "0.000 s";

    diffSelect.disabled = true;
    startBtn.disabled = true;

    setState("암기");
    statusLeft.textContent = "5초 동안 숫자를 외우세요!";
    buildGrid();
    setHidden(false);
    renderKpis();
    renderBest();
    renderHistory();

    // 5초 후 숨기고 플레이 시작
    clearTimeout(revealTimer);
    revealTimer = setTimeout(() => {
      phase = "play";
      setState("플레이");
      statusLeft.textContent = "사라졌습니다. 1부터 순서대로 누르세요!";
      setHidden(true);

      startAt = performance.now();
      raf = requestAnimationFrame(tick);
    }, SHOW_MS);
  }

  function finish(completed) {
    phase = "done";
    cancelAnimationFrame(raf);
    clearTimeout(revealTimer);

    const time_ms = Math.max(0, Math.round(performance.now() - startAt));
    setState("완료");

    const at = new Date().toLocaleString();
    const record = { completed, hit, time_ms, at };

    // 저장/정렬 규칙:
    // 1) 완주가 우선
    // 2) 완주끼리는 time_ms 오름차순
    // 3) 미완주끼리는 hit 내림차순, 동률이면 time_ms 오름차순
    scores.push(record);
    scores.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? -1 : 1;

      if (a.completed && b.completed) return a.time_ms - b.time_ms;

      if (a.hit !== b.hit) return b.hit - a.hit;
      return a.time_ms - b.time_ms;
    });

    scores = scores.slice(0, 10);
    saveScores(scores);

    setHidden(false); // 결과 확인용으로 다시 보여주기
    diffSelect.disabled = false;
    startBtn.disabled = false;
    startBtn.textContent = "다시 시작";

    if (completed) {
      statusLeft.textContent = `완주! 기록: ${fmt(time_ms)} s`;
    } else {
      statusLeft.textContent = `종료! 성공: ${hit}/${total}, 시간: ${fmt(time_ms)} s`;
    }

    renderBest();
    renderHistory();
  }

  function onCellClick(e) {
    if (phase !== "play") return;

    const cell = e.currentTarget;
    if (cell.classList.contains("done")) return;

    const num = parseInt(cell.dataset.num, 10);

    if (num === nextNum) {
      cell.classList.add("good", "done");
      setTimeout(() => cell.classList.remove("good"), 140);

      hit += 1;
      nextNum += 1;

      renderKpis();

      if (nextNum > total) {
        finish(true);
      }
      return;
    }

    // 오답 피드백만 (패널티 없음 - 원하면 넣어줄게)
    cell.classList.add("bad");
    setTimeout(() => cell.classList.remove("bad"), 160);
  }


function restart() {
  // 진행 중이면 중단
  cancelAnimationFrame(raf);
  clearTimeout(revealTimer);

  phase = "idle";
  diffSelect.disabled = false;
  startBtn.disabled = false;
  startBtn.textContent = "시작";

  nextNum = 1;
  hit = 0;
  kpiTime.textContent = "0.000";
  statusLeft.textContent = "재시작 준비 완료. 시작을 누르세요.";
  setState("준비");

  buildGrid();
  setHidden(false);
  renderKpis();
}



  diffSelect.addEventListener("change", () => {
    if (phase === "show" || phase === "play") return;
    parseDiff();
    scores = loadScores();
    setState("준비");
    statusLeft.textContent = "시작을 누르면 5초 동안 숫자가 표시됩니다.";
    startBtn.textContent = "시작";
    buildGrid();
    setHidden(false);
    nextNum = 1;
    hit = 0;
    kpiTime.textContent = "0.000 s";
    renderKpis();
    renderBest();
    renderHistory();
  });

  startBtn.addEventListener("click", () => {
    if (phase === "show" || phase === "play") return;
    start();
  });

  homeBtn.addEventListener("click", () => (window.location.href = "/"));
  restartBtn.addEventListener("click", restart);


  // init
  (function init() {
    parseDiff();
    scores = loadScores();
    setState("준비");
    buildGrid();
    setHidden(false);
    renderKpis();
    renderBest();
    renderHistory();
  })();
})();
