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
  const kLast = $("kLast");
  const kAvg = $("kAvg");

  const statusLeft = $("statusLeft");
  const resultBadge = $("resultBadge");
  const bestText = $("bestText");

  // --- 캔버스 HiDPI 보정 (중요)
  

  // --- 게임 좌표는 "CSS 픽셀" 기준으로 쓰자
  function W() { return cv.getBoundingClientRect().width; }
  function H() { return cv.getBoundingClientRect().height; }

  // ✅ 궤적/애니 상태
  let lastTrajectory = [];
  let liveTrail = [];
  let animReq = null;
  let showTrajectory = true;

  // ---- 설정값
  let speed = 50; // 10 ~ 120
  let angle = 45; // 5 ~ 85

  // ---- 게임 상태
  const TOTAL = 10;
  let round = 1;
  let distances = [];
  let locked = false;

  // ---- 물리
  const g = 9.8;
  let scale = 4.0;

let CW = 900, CH = 520; // 기본값
function W(){ return CW; }
function H(){ return CH; }


function ensureCanvas() {
  const rect = cv.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  // 화면에 보이는 크기(CSS px)
  const cssW = Math.max(1, Math.round(rect.width));
  const cssH = Math.max(1, Math.round(rect.height));

  // 내부 해상도(device px)
  cv.width  = Math.round(cssW * dpr);
  cv.height = Math.round(cssH * dpr);

  // 이후 모든 좌표를 CSS px로 쓰기 위해 transform
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return { w: cssW, h: cssH };
}



  function origin() {
    return { x: 70, y: H() - 70 };
  }

  let target = { x: 700, y: 240 };



  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function bestKey() {
    return "utilweb_target_best_avg";
  }

  function getBest() {
    const v = localStorage.getItem(bestKey());
    return v ? parseFloat(v) : null;
  }

  function setBest(v) {
    localStorage.setItem(bestKey(), String(v));
  }

  function setBadge(text, mode) {
    resultBadge.textContent = text;
    resultBadge.classList.remove("good", "bad");
    if (mode) resultBadge.classList.add(mode);
  }

  function updateUI() {
    speedText.textContent = String(speed);
    angleText.textContent = String(angle);
    kRound.textContent = `${round} / ${TOTAL}`;

    const last = distances.length ? distances[distances.length - 1] : null;
    kLast.textContent = last == null ? "-" : `${last.toFixed(1)} px`;

    if (!distances.length) {
      kAvg.textContent = "-";
    } else {
      const avg = distances.reduce((a, b) => a + b, 0) / distances.length;
      kAvg.textContent = `${avg.toFixed(1)} px`;
    }

    const b = getBest();
    bestText.textContent = b ? `Best Avg: ${b.toFixed(1)} px` : "Best Avg: -";
  }

  function randTarget() {
    const margin = 70;
    const xMin = 280;
    const xMax = W() - margin;
    const yMin = margin;
    const yMax = H() - 140;
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
    ctx.beginPath();
    ctx.moveTo(0, H() - 70);
    ctx.lineTo(W(), H() - 70);
    ctx.stroke();
    ctx.restore();
  }

  function drawCannon() {
    const o = origin();
    ctx.save();

    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(o.x, o.y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const rad = (angle * Math.PI) / 180;
    const len = 55;
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

    ctx.strokeStyle = "rgba(80,160,255,1)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 18, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,80,80,1)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(target.x - 24, target.y);
    ctx.lineTo(target.x + 24, target.y);
    ctx.moveTo(target.x, target.y - 24);
    ctx.lineTo(target.x, target.y + 24);
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

    const grad = ctx.createRadialGradient(x, y, 2, x, y, 10);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(120,200,255,0.2)");

    ctx.fillStyle = grad;
    ctx.shadowColor = "rgba(120,200,255,0.9)";
    ctx.shadowBlur = 18;

    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
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
    drawCannon();

    if (ballPos) drawBall(ballPos.x, ballPos.y);
  }
function simulateShot() {
  const o = origin();
  const rad = (angle * Math.PI) / 180;

  const v = speed * scale;          // px/s
  const vx = Math.cos(rad) * v;
  const vy = Math.sin(rad) * v;
  const G  = g * scale;             // px/s^2

  const dt = 1 / 60;
  const maxSteps = 60 * 10;         // 최대 10초
  const groundY = H() - 70;

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

    // 화면 밖이면 종료
    if (x > W() + 50 || y > H() + 50 || y < -100) break;

    // 바닥 닿으면 종료 (첫 점 제외)
    if (step > 0 && y >= groundY) break;
  }

  return { points, minD };
}


  function animateShot(points, onDone) {
    if (animReq) cancelAnimationFrame(animReq);

    liveTrail = [];
    const TRAIL_MAX = 55; // 꼬리 더 길게
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
    distances.push(minD);

    const hit = minD <= 18;
    setBadge(hit ? "HIT" : "MISS", hit ? "good" : "bad");

    // ✅ 디버그 포함: 포인트 개수 표시
    statusLeft.textContent = hit
      ? `타겟에 근접했습니다. 거리 ${minD.toFixed(1)} px (pts ${ptsLen})`
      : `조금 빗나갔습니다. 거리 ${minD.toFixed(1)} px (pts ${ptsLen})`;

    if (round >= TOTAL) {
      const avg = distances.reduce((a, b) => a + b, 0) / distances.length;

      const b = getBest();
      if (!b || avg < b) {
        setBest(avg);
        statusLeft.textContent = `게임 종료. 평균 ${avg.toFixed(1)} px (Best 갱신)`;
        setBadge("FINISH", "good");
      } else {
        statusLeft.textContent = `게임 종료. 평균 ${avg.toFixed(1)} px`;
        setBadge("FINISH", "good");
      }

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

  // ✅ 발사 시작할 때만 캔버스 확정
  const s = ensureCanvas();
  CW = s.w;
  CH = s.h;

  locked = true;
  fireBtn.disabled = true;
  setBadge("FIRING", null);

  const { points, minD } = simulateShot();

  // ✅ pts 확인용(임시)
  // statusLeft.textContent = `pts=${points.length}, W=${W()}, H=${H()}`;

  if (!points.length) {
    locked = false;
    fireBtn.disabled = false;
    setBadge("READY", null);
    statusLeft.textContent = "발사가 실패했습니다. (points=0) 각도/속도를 조정하세요.";
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
    if (animReq) cancelAnimationFrame(animReq);
    animReq = null;

    round = 1;
    distances = [];
    locked = false;
    fireBtn.disabled = false;

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

  speedDown.addEventListener("click", () => changeSpeed(-1));
  speedUp.addEventListener("click", () => changeSpeed(+1));
  angleDown.addEventListener("click", () => changeAngle(-1));
  angleUp.addEventListener("click", () => changeAngle(+1));

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

function init() {
  const s = ensureCanvas();   // ✅ 이것만 사용
  CW = s.w;
  CH = s.h;

  randTarget();
  updateUI();
  redraw();
}

  init();
})();
