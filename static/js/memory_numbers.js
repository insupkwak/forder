(function () {
  const $ = (id) => document.getElementById(id);

  const diffSelect = $("diffSelect");
  const startBtn = $("startBtn");
  const restartBtn = $("restartBtn"); // 재시작 버튼 쓰는 경우
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

  const SHOW_MS = 5000;
  const KEY_PREFIX = "memory_numbers_rank_"; // 난이도별 저장

  let n = 4;
  let total = 16;

  let phase = "idle"; // idle | show | play | done
  let nextNum = 1;
  let hit = 0;

  let startAt = 0;
  let raf = 0;
  let revealTimer = 0;

  let scores = [];

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

  function fmt3(ms) {
    return (ms / 1000).toFixed(3);
  }

  function fmt1(ms) {
    return (ms / 1000).toFixed(1);
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

  // 베스트는 "단계 우선 + 시간" 기준으로 1등을 요약 표시
  function renderBest() {
    if (!scores.length) {
      kpiBest.textContent = "-";
      return;
    }
    const best = scores[0];
    // KPI는 간단히: 단계/시간(소수1자리)
    kpiBest.textContent = `${best.hit}/${total} · ${fmt1(best.time_ms)}s`;
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
      div.innerHTML = `<div class="l">TOP ${i + 1} · ${s.at}</div><div class="r">${s.hit}/${total} · ${fmt3(s.time_ms)} s</div>`;
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
    // 표시만 깔끔하게(초 단위 숫자만 원하면 fmt3(ms)만 넣어도 됨)
    kpiTime.textContent = fmt3(ms);
    raf = requestAnimationFrame(tick);
  }

  function start() {
    parseDiff();
    scores = loadScores();

    phase = "show";
    nextNum = 1;
    hit = 0;

    kpiTime.textContent = "0.000";
    renderKpis();

    diffSelect.disabled = true;
    startBtn.disabled = true;

    setState("암기");
    statusLeft.textContent = "5초 동안 숫자를 외우세요!";
    buildGrid();
    setHidden(false);

    renderBest();
    renderHistory();

    clearTimeout(revealTimer);
    revealTimer = setTimeout(() => {
      phase = "play";
      setState("플레이");
      statusLeft.textContent = "사라졌습니다. 1부터 순서대로 누르세요! (틀리면 즉시 종료)";
      setHidden(true);

      startAt = performance.now();
      raf = requestAnimationFrame(tick);
    }, SHOW_MS);
  }

  // ✅ 기록 저장: 단계(hit) + 시간(time_ms)
  // ✅ 순위 정렬: 단계 desc, 시간 asc
  function finish(reasonText) {
    if (phase !== "play") return;

    phase = "done";
    cancelAnimationFrame(raf);
    clearTimeout(revealTimer);

    const time_ms = Math.max(0, Math.round(performance.now() - startAt));

    setState("완료");
    setHidden(false); // 끝나면 답 다시 보여주기

    diffSelect.disabled = false;
    startBtn.disabled = false;
    startBtn.textContent = "다시 시작";

    const at = new Date().toLocaleString();
    const record = { hit, time_ms, at };

    scores.push(record);
    scores.sort((a, b) => {
      if (a.hit !== b.hit) return b.hit - a.hit;     // 단계 높은 순
      return a.time_ms - b.time_ms;                  // 시간 짧은 순
    });
    scores = scores.slice(0, 10);
    saveScores(scores);

    if (hit >= total) {
      statusLeft.textContent = `완료! ${hit}/${total} · 시간 ${fmt3(time_ms)} s`;
    } else {
      statusLeft.textContent = `${reasonText}  ${hit}/${total} · 시간 ${fmt3(time_ms)} s`;
    }

    renderBest();
    renderHistory();
  }

  // ✅ 틀리면 바로 끝
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
        // 다 맞춘 경우도 기록 저장(단계=total)
        finish("완주!");
      }
      return;
    }

    // 오답이면 즉시 종료
    cell.classList.add("bad");
    setTimeout(() => cell.classList.remove("bad"), 160);

    finish("오답! 게임 종료.");
  }

  function restart() {
    cancelAnimationFrame(raf);
    clearTimeout(revealTimer);

    phase = "idle";
    diffSelect.disabled = false;
    startBtn.disabled = false;
    startBtn.textContent = "시작";

    nextNum = 1;
    hit = 0;
    kpiTime.textContent = "0.000";

    setState("준비");
    statusLeft.textContent = "재시작 준비 완료. 시작을 누르세요.";
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

    nextNum = 1;
    hit = 0;
    kpiTime.textContent = "0.000";

    buildGrid();
    setHidden(false);

    renderKpis();
    renderBest();
    renderHistory();
  });

  startBtn.addEventListener("click", () => {
    if (phase === "show" || phase === "play") return;
    start();
  });

  if (restartBtn) restartBtn.addEventListener("click", restart);

  homeBtn.addEventListener("click", () => (window.location.href = "/"));

  // init
  (function init() {
    parseDiff();
    scores = loadScores();

    setState("준비");
    statusLeft.textContent = "시작을 누르면 5초 동안 숫자가 표시됩니다.";
    startBtn.textContent = "시작";

    nextNum = 1;
    hit = 0;
    kpiTime.textContent = "0.000";

    buildGrid();
    setHidden(false);

    renderKpis();
    renderBest();
    renderHistory();
  })();
})();
