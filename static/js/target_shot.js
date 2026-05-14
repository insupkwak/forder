(function () {
  const $ = (id) => document.getElementById(id);

  const cv = $("cv");
  const ctx = cv.getContext("2d");

  const speedText = $("speedText");
  const angleText = $("angleText");
  const speedDown = $("speedDown");
  const speedUp = $("speedUp");
  const angleDown = $("angleDown");
  const angleUp = $("angleUp");

  const fireBtn = $("fireBtn");
  const resetBtn = $("resetBtn");

  const kRound = $("kRound");
  const kLast = $("kLast"); // KPI: 콤보
  const kAvg = $("kAvg");   // KPI: 점수(총점)

  const statusLeft = $("statusLeft");
  const resultBadge = $("resultBadge");
  const bestText = $("bestText");

  // ✅ 기록 표 (HTML에 <tbody id="scoreTableBody"></tbody> 필요)
  const scoreTableBody = $("scoreTableBody");

  // ---- 설정값
  let speed = 50; // 10 ~ 120
  let angle = 45; // 5 ~ 85

  // ---- 게임 상태
  const TOTAL = 10;
  let round = 1;
  let locked = false;

  // ---- 물리
  const g = 9.8;
  let scale = 4.0;

  // ✅ 궤적/애니 상태
  let lastTrajectory = [];
  let liveTrail = [];
  let animReq = null;
  let showTrajectory = true;

  // ✅ HIT 효과 상태
  let hitFX = null; // { x, y, start, dur }

  // ✅ 점수/콤보 상태
  let totalScore = 0;   // 누적 총점
  let comboStreak = 0;  // 연속 조건 충족 횟수 (HIT & raw>=5)

  // 캔버스 CSS 기준 크기
  let CW = 900, CH = 520;
  function W() { return CW; }
  function H() { return CH; }

  // --- 모바일 설정
  function isMobile() {
    return window.matchMedia("(max-width: 640px)").matches;
  }
  let uiScale = 1;

  function groundY() {
    return isMobile() ? (H() * 0.90) : (H() - 70);
  }

  function origin() {
    const x = isMobile() ? (W() * 0.10) : 70;
    const y = groundY();
    return { x, y };
  }

  // ✅ 타겟
  let target = { x: 700, y: 240 };

  // =========================
  // 점수 기록(최고기록 TOP 10)
  // =========================
  function scoreStorageKey() {
    return "utilweb_target_best_scores_top10";
  }

  function loadScoreHistory() {
    try {
      const raw = localStorage.getItem(scoreStorageKey());
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveScoreHistory(list) {
    localStorage.setItem(scoreStorageKey(), JSON.stringify(list));
  }

  function nowStamp() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }

  // ✅ 최고기록만 유지: 점수 내림차순, 동점이면 최신 우선
  function addScoreRecord(score) {
    const list = loadScoreHistory();

    list.push({
      date: nowStamp(),
      score: score,
      ts: Date.now()
    });

    list.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.ts - a.ts;
    });

    const top10 = list.slice(0, 10);
    saveScoreHistory(top10);
    renderScoreTable();
  }

function renderScoreTable(){
  if (!scoreTableBody) return;

  const list = loadScoreHistory();
  scoreTableBody.innerHTML = "";

  if (!list.length){
    scoreTableBody.innerHTML = `<tr><td colspan="3">기록 없음</td></tr>`;
    return;
  }

  list.forEach((item, idx) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${item.date}</td>
      <td>${item.score} 점</td>
    `;

    scoreTableBody.appendChild(tr);
  });
}


  // =========================
  // 유틸/점수/콤보
  // =========================
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function setBadge(text, mode) {
    resultBadge.textContent = text;
    resultBadge.classList.remove("good", "bad");
    if (mode) resultBadge.classList.add(mode);
  }

  // 콤보 배수: x2, x4, x6...
  function comboMultiplier() {
    if (comboStreak <= 1) return 1;
    return (comboStreak - 1) * 2;
  }

  function comboText() {
    return `x${comboMultiplier()}`;
  }

  // raw 점수(0~10): HIT일 때만 거리 비례
  function calcRawScore(minD, hitRadius) {
    if (minD > hitRadius) return 0;
    const s = 10 * (1 - (minD / hitRadius));
    return Math.max(0, Math.min(10, s));
  }

  // BestText는 최고점 표시로 교체
  function updateBestText() {
    const list = loadScoreHistory();
    if (!list.length) {
      bestText.textContent = "Best Score: -";
      return;
    }
    bestText.textContent = `Best Score: ${list[0].score} 점`;
  }

  function updateUI() {
    speedText.textContent = String(speed);
    angleText.textContent = String(angle);

    kRound.textContent = `${round} / ${TOTAL}`;
    kLast.textContent = comboText();
    kAvg.textContent = `${totalScore} 점`;

    updateBestText();
  }

  // =========================
  // 캔버스/그리기
  // =========================
  function ensureCanvas() {
    const rect = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const cssW = Math.max(1, Math.round(rect.width));
    const cssH = Math.max(1, Math.round(rect.height));

    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssH * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    uiScale = isMobile() ? (1 / 3) : 1;

    return { w: cssW, h: cssH };
  }

  function randTarget() {
    const margin = 70;
    const gy = groundY();

    const xMin = Math.max(200, Math.floor(W() * 0.30));
    const xMax = W() - margin;

    const yMin = margin;
    const yMax = Math.max(yMin + 40, gy - (120 * uiScale));

    target.x = Math.floor(Math.random() * (xMax - xMin + 1)) + xMin;
    target.y = Math.floor(Math.random() * (yMax - yMin + 1)) + yMin;
  }

  function clear() {
    ctx.clearRect(0, 0, W(), H());
  }

  function drawBackground() {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    const gy = groundY();
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(W(), gy);
    ctx.stroke();
    ctx.restore();
  }

  function drawCannon() {
    const o = origin();
    ctx.save();

    const baseR = 18 * uiScale;
    const lineW = 2 * uiScale;
    const len = 55 * uiScale;

    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth = Math.max(1, lineW);

    ctx.beginPath();
    ctx.arc(o.x, o.y, baseR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const rad = (angle * Math.PI) / 180;
    const x2 = o.x + Math.cos(rad) * len;
    const y2 = o.y - Math.sin(rad) * len;

    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.restore();
  }

  function drawTarget() {
    ctx.save();

    const R1 = 18 * uiScale;
    const R2 = 8 * uiScale;
    const cross = 24 * uiScale;

    ctx.strokeStyle = "rgba(80,160,255,1)";
    ctx.lineWidth = Math.max(1, 3 * uiScale);
    ctx.beginPath();
    ctx.arc(target.x, target.y, R1, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,80,80,1)";
    ctx.lineWidth = Math.max(1, 2 * uiScale);
    ctx.beginPath();
    ctx.arc(target.x, target.y, R2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(target.x - cross, target.y);
    ctx.lineTo(target.x + cross, target.y);
    ctx.moveTo(target.x, target.y - cross);
    ctx.lineTo(target.x, target.y + cross);
    ctx.stroke();

    ctx.restore();
  }

  function drawTrajectory(points, color, width = 3) {
    if (!points || !points.length) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
    ctx.restore();
  }

  function drawBall(x, y) {
    ctx.save();
    const r = 6 * uiScale;

    const grad = ctx.createRadialGradient(x, y, 2 * uiScale, x, y, 10 * uiScale);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(120,200,255,0.2)");

    ctx.fillStyle = grad;
    ctx.shadowColor = "rgba(120,200,255,0.9)";
    ctx.shadowBlur = 18 * uiScale;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawHitEffect() {
    if (!hitFX) return;
    const now = performance.now();
    const t = (now - hitFX.start) / hitFX.dur;
    if (t >= 1) { hitFX = null; return; }

    const x = hitFX.x, y = hitFX.y;
    const e = 1 - Math.pow(1 - t, 3);

    const r0 = 10 * uiScale;
    const r1 = 70 * uiScale;
    const r = r0 + (r1 - r0) * e;

    ctx.save();
    ctx.globalAlpha = (1 - t) * 0.9;
    ctx.strokeStyle = "rgba(46,204,113,1)";
    ctx.lineWidth = Math.max(1, 4 * uiScale * (1 - t));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = (1 - t) * 0.35;
    ctx.fillStyle = "rgba(46,204,113,1)";
    ctx.beginPath();
    ctx.arc(x, y, 22 * uiScale * (1 - t * 0.3), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function redraw(ballPos) {
    clear();
    drawBackground();

    if (showTrajectory && lastTrajectory.length) {
      drawTrajectory(lastTrajectory, "rgba(255,255,255,0.45)", 3);
    }
    if (liveTrail.length) {
      drawTrajectory(liveTrail, "rgba(255,255,255,0.95)", 4);
    }

    drawTarget();
    drawHitEffect();
    drawCannon();

    if (ballPos) drawBall(ballPos.x, ballPos.y);
  }

  // =========================
  // 물리/애니/라운드
  // =========================
  function simulateShot() {
    const o = origin();
    const rad = (angle * Math.PI) / 180;

    const v = speed * scale;
    const vx = Math.cos(rad) * v;
    const vy = Math.sin(rad) * v;
    const G = g * scale;

    const dt = 1 / 60;
    const maxSteps = 60 * 10;
    const ground = groundY();

    let points = [];
    let minD = Infinity;

    for (let step = 0; step < maxSteps; step++) {
      const t = step * dt;
      const x = o.x + vx * t;
      const y = o.y - (vy * t - 0.5 * G * t * t);

      points.push({ x, y });

      const dx = x - target.x;
      const dy = y - target.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minD) minD = d;

      if (x > W() + 50 || y > H() + 50 || y < -100) break;
      if (step > 0 && y >= ground) break;
    }

    return { points, minD };
  }

  function animateShot(points, onDone) {
    if (animReq) cancelAnimationFrame(animReq);

    liveTrail = [];
    const TRAIL_MAX = 55;
    let i = 0;

    const step = () => {
      const p = points[i];

      liveTrail.push(p);
      if (liveTrail.length > TRAIL_MAX) liveTrail.shift();

      redraw(p);

      i += 1;
      if (i < points.length) {
        animReq = requestAnimationFrame(step);
      } else {
        liveTrail = [];
        redraw();
        onDone && onDone();
      }
    };

    animReq = requestAnimationFrame(step);
  }

  function finishRound(minD, ptsLen) {
    const hitRadius = 18 * uiScale;
    const isHit = minD <= hitRadius;

    const raw = isHit ? calcRawScore(minD, hitRadius) : 0;

    // 콤보 조건: HIT + raw>=5
    if (isHit && raw >= 5) comboStreak += 1;
    else comboStreak = 0;

    const mult = comboMultiplier();
    const gain = Math.round(raw * mult);
    totalScore += gain;

    if (isHit) {
      setBadge("HIT", "good");
      hitFX = { x: target.x, y: target.y, start: performance.now(), dur: 520 };
      statusLeft.textContent =
        `HIT! raw ${raw.toFixed(1)}/10, ${comboText()} → +${gain}점 (거리 ${minD.toFixed(1)} px)`;
    } else {
      setBadge("MISS", "bad");
      statusLeft.textContent = `MISS. +0점 (거리 ${minD.toFixed(1)} px)`;
    }

    if (round >= TOTAL) {
      setBadge("FINISH", "good");
      statusLeft.textContent = `게임 종료. 총점 ${totalScore}점`;

      // ✅ 최고기록 TOP10에 반영
      addScoreRecord(totalScore);
      submitToLeaderboard(totalScore);

      locked = false;
      fireBtn.disabled = true;

      updateUI();
      redraw();
      return;
    }

    round += 1;
    randTarget();
    locked = false;
    fireBtn.disabled = false;

    updateUI();
    redraw();
  }

  function fire() {
    if (locked) return;

    const s = ensureCanvas();
    CW = s.w;
    CH = s.h;

    locked = true;
    fireBtn.disabled = true;
    setBadge("FIRING", null);

    const { points, minD } = simulateShot();

    if (!points.length) {
      locked = false;
      fireBtn.disabled = false;
      setBadge("READY", null);
      statusLeft.textContent = "발사가 실패했습니다. 각도/속도를 조정하세요.";
      return;
    }

    lastTrajectory = points.slice();

    animateShot(points, () => {
      finishRound(minD, points.length);
      redraw();
    });
  }

  function resetGame() {
    lastTrajectory = [];
    liveTrail = [];
    hitFX = null;
    if (animReq) cancelAnimationFrame(animReq);
    animReq = null;

    round = 1;
    locked = false;
    fireBtn.disabled = false;

    totalScore = 0;
    comboStreak = 0;

    setBadge("READY", null);
    statusLeft.textContent = "타겟은 매 라운드 랜덤 위치입니다.";

    randTarget();
    updateUI();
    redraw();
  }

  function changeSpeed(d) {
    speed = clamp(speed + d, 10, 120);
    updateUI();
    redraw();
  }

  function changeAngle(d) {
    angle = clamp(angle + d, 5, 85);
    updateUI();
    redraw();
  }

  // ✅ 길게 누르면 계속 증가/감소
  function bindHold(btn, action) {
    let t1 = null;
    let t2 = null;
    let holding = false;

    const clearTimers = () => {
      if (t1) { clearTimeout(t1); t1 = null; }
      if (t2) { clearInterval(t2); t2 = null; }
      holding = false;
    };

    const start = (e) => {
      if (btn.disabled) return;
      e.preventDefault();

      action();
      holding = true;

      t1 = setTimeout(() => {
        if (!holding) return;
        t2 = setInterval(() => {
          if (btn.disabled) return;
          action();
        }, 60);
      }, 250);
    };

    const stop = () => clearTimers();

    btn.addEventListener("pointerdown", start, { passive: false });
    btn.addEventListener("pointerup", stop);
    btn.addEventListener("pointercancel", stop);
    btn.addEventListener("pointerleave", stop);
    btn.addEventListener("lostpointercapture", stop);
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  bindHold(speedDown, () => changeSpeed(-1));
  bindHold(speedUp, () => changeSpeed(+1));
  bindHold(angleDown, () => changeAngle(-1));
  bindHold(angleUp, () => changeAngle(+1));

  resetBtn.addEventListener("click", resetGame);
  fireBtn.addEventListener("click", fire);

  window.addEventListener("resize", () => {
    const s = ensureCanvas();
    CW = s.w; CH = s.h;
    redraw();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === " ") { e.preventDefault(); fire(); }
    if (e.key === "ArrowUp") changeAngle(+1);
    if (e.key === "ArrowDown") changeAngle(-1);
    if (e.key === "ArrowRight") changeSpeed(+1);
    if (e.key === "ArrowLeft") changeSpeed(-1);
    if (e.key === "r" || e.key === "R") resetGame();
  });

  // ---- 전체 랭킹 ----
  const RANK_GAME = "target";
  const rankBox = document.getElementById("globalRank");
  const nickBtn = document.getElementById("changeNickBtn");

  function rankFormat(it){ return `${Math.round(it.primary)} 점`; }
  function renderRank(){
    if (window.Leaderboard && rankBox) {
      window.Leaderboard.render(rankBox, RANK_GAME, "default", { format: rankFormat });
    }
  }
  async function submitToLeaderboard(score){
    if (!window.Leaderboard) return;
    await window.Leaderboard.submit(RANK_GAME, {
      mode: "default",
      primary: score
    });
    renderRank();
  }
  if (nickBtn) {
    nickBtn.addEventListener("click", () => {
      if (window.Leaderboard) {
        window.Leaderboard.promptNickname();
        renderRank();
      }
    });
  }

  function init() {
    const s = ensureCanvas();
    CW = s.w;
    CH = s.h;

    randTarget();
    renderScoreTable(); // ✅ 최초 로드 시 표 채우기
    updateUI();
    redraw();
    renderRank();
  }

  init();
})();
