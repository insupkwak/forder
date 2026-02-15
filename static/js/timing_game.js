(function () {
  const $ = (id) => document.getElementById(id);

  const mainBtn = $("mainBtn");
  const homeBtn = $("homeBtn");
  const stateMini = $("stateMini");
  const timerText = $("timerText");
  const resultText = $("resultText");

  const targetSelect = $("targetSelect");
  const targetLabel = $("targetLabel");

  const kpiThis = $("kpiThis");
  const kpiDiff = $("kpiDiff");
  const kpiBest = $("kpiBest");
  const history = $("history");

  // 목표(ms) - select에 따라 변경
  let TARGET_MS = parseInt(targetSelect.value, 10);

  // 기록 저장 (목표초별로 분리 저장)
  // ex) timing_game_best10_10000
  const KEY_PREFIX = "timing_game_best10_";

  let running = false;
  let startAt = 0;
  let raf = 0;

  function keyForTarget() {
    return KEY_PREFIX + String(TARGET_MS);
  }

  const load = () => {
    try {
      return JSON.parse(localStorage.getItem(keyForTarget()) || "[]");
    } catch {
      return [];
    }
  };

  const save = (arr) => localStorage.setItem(keyForTarget(), JSON.stringify(arr));

  let scores = load();

  function setState(s) {
    stateMini.textContent = "상태: " + s;
  }

  function fmt(ms) {
    return (ms / 1000).toFixed(2);
  }

  function updateTargetLabel() {
    TARGET_MS = parseInt(targetSelect.value, 10);
    targetLabel.textContent = (TARGET_MS / 1000).toFixed(2) + "초";

    // 목표 바꾸면 그 목표의 기록으로 전환
    scores = load();
    kpiThis.textContent = "-";
    kpiDiff.textContent = "-";
    timerText.textContent = "0.00";
    resultText.textContent = "시작 버튼을 누르세요.";
    render();
  }

  function render() {
    const best = scores.length ? Math.min(...scores.map((s) => s.diff)) : null;
    kpiBest.textContent = best == null ? "-" : `${best} ms`;

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
      div.innerHTML = `<div class="l">TOP ${i + 1} · ${s.at}</div>
                       <div class="r">${fmt(s.ms)}s (오차 ${s.diff}ms)</div>`;
      history.appendChild(div);
    });
  }

  function tick() {
    if (!running) return;
    const now = performance.now();
    const ms = Math.max(0, Math.round(now - startAt));
    timerText.textContent = fmt(ms);
    raf = requestAnimationFrame(tick);
  }

  function start() {
    running = true;
    startAt = performance.now();
    timerText.textContent = "0.00";
    resultText.textContent = "멈추려면 버튼을 다시 누르세요.";
    mainBtn.textContent = "정지";
    setState("진행");

    // 진행 중 목표 변경 막기
    targetSelect.disabled = true;

    raf = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);

    const ms = Math.max(0, Math.round(performance.now() - startAt));
    const diff = Math.abs(ms - TARGET_MS);

    kpiThis.textContent = `${fmt(ms)}s`;
    kpiDiff.textContent = `${diff} ms`;

    resultText.textContent = `기록: ${fmt(ms)}s · 오차: ${diff}ms`;
    mainBtn.textContent = "다시 시작";
    setState("완료");

    // 진행 종료 후 목표 변경 다시 허용
    targetSelect.disabled = false;

    // best10 (오차가 낮을수록 좋음)
    const at = new Date().toLocaleString();
    scores.push({ ms, diff, at });
    scores.sort((a, b) => a.diff - b.diff);
    scores = scores.slice(0, 10);
    save(scores);

    render();
  }

  mainBtn.addEventListener("click", () => {
    if (!running) start();
    else stop();
  });

  targetSelect.addEventListener("change", () => {
    if (running) return;
    updateTargetLabel();
  });

  homeBtn.addEventListener("click", () => (window.location.href = "/"));

  // init
  setState("준비");
  updateTargetLabel(); // 라벨/기록 로드 포함
})();
