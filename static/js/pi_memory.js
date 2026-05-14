(function () {
  const $ = (id) => document.getElementById(id);

  const PI = String(window.PI_DECIMALS || "");
  const TOTAL = parseInt(window.PI_TOTAL || PI.length, 10);

  const piBoard = $("piBoard");
  const clearBanner = $("clearBanner");
  const stateMini = $("stateMini");
  const statusLeft = $("statusLeft");

  const kCount = $("kCount");
  const kTime = $("kTime");
  const kBadge = $("kBadge");

  const pad = $("pad");
  const startBtn = $("startBtn");
  const resetBtn = $("resetBtn");

  const rankBox = $("globalRank");
  const nickBtn = $("changeNickBtn");

  // ---------- state ----------
  let phase = "ready";   // ready | playing | over | clear
  let typed = "";
  let startAt = 0;
  let raf = 0;
  let submitted = false;

  // ---------- 표시 ----------
  function chunkify(s) {
    // 10자리 단위 공백 (가독성)
    let out = "";
    for (let i = 0; i < s.length; i++) {
      if (i > 0 && i % 10 === 0) out += " ";
      out += s[i];
    }
    return out;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
  }

  function renderBoard() {
    const typedPart = chunkify(typed);
    let html = '<span class="typed">3.' + escapeHtml(typedPart) + '</span>';
    if (phase === "playing") {
      html += '<span class="cursor"></span>';
    }
    if (phase === "over") {
      // 정답 일부 힌트로 보여주기 (다음 20자리)
      const rest = PI.slice(typed.length, typed.length + 30);
      if (rest) html += '<span class="next-hint">' + escapeHtml(chunkify(rest)) + '…</span>';
    }
    piBoard.innerHTML = html;
    // 항상 맨 아래로 스크롤
    piBoard.scrollTop = piBoard.scrollHeight;
  }

  function setBadge(text, mode) {
    kBadge.textContent = text;
    kBadge.classList.remove("good", "bad", "gold");
    if (mode) kBadge.classList.add(mode);
  }
  function setKpi() {
    kCount.textContent = `${typed.length} / ${TOTAL}`;
  }
  function fmt(ms) { return (ms / 1000).toFixed(3); }

  function tick() {
    if (phase !== "playing") return;
    const ms = Math.max(0, Math.round(performance.now() - startAt));
    kTime.textContent = fmt(ms) + " s";
    raf = requestAnimationFrame(tick);
  }

  function enablePad(on) {
    pad.querySelectorAll("[data-key]").forEach(b => b.disabled = !on);
  }

  // ---------- flow ----------
  function goReady() {
    cancelAnimationFrame(raf);
    phase = "ready";
    typed = "";
    submitted = false;
    startAt = 0;
    kTime.textContent = "0.000 s";
    setBadge("READY", null);
    setKpi();
    statusLeft.textContent = "시작을 누른 뒤 키패드로 한 자리씩 입력하세요.";
    stateMini.textContent = "상태: 준비";
    clearBanner.style.display = "none";
    piBoard.classList.remove("bad");
    enablePad(false);
    startBtn.disabled = false;
    startBtn.textContent = "시작";
    renderBoard();
  }

  function start() {
    if (phase === "playing") return;
    phase = "playing";
    typed = "";
    submitted = false;
    startAt = performance.now();
    kTime.textContent = "0.000 s";
    setBadge("PLAY", null);
    setKpi();
    statusLeft.textContent = "키패드로 다음 숫자를 누르세요. (PC: 0~9 키)";
    stateMini.textContent = "상태: 진행";
    clearBanner.style.display = "none";
    piBoard.classList.remove("bad");
    enablePad(true);
    startBtn.disabled = true;
    startBtn.textContent = "진행 중";
    renderBoard();
    raf = requestAnimationFrame(tick);
  }

  function flashBtn(key, cls) {
    const btn = pad.querySelector(`.pad-btn[data-key="${key}"]`);
    if (!btn) return;
    btn.classList.add(cls);
    setTimeout(() => btn.classList.remove(cls), 140);
  }

  function gameOver(reason) {
    if (phase !== "playing") return;
    cancelAnimationFrame(raf);
    phase = "over";
    const elapsed = Math.max(0, Math.round(performance.now() - startAt));
    kTime.textContent = fmt(elapsed) + " s";

    setBadge("GAME OVER", "bad");
    stateMini.textContent = "상태: 종료";
    piBoard.classList.add("bad");
    statusLeft.textContent = `틀렸습니다. ${typed.length}자리에서 종료 · ${fmt(elapsed)}s ${reason ? "· " + reason : ""}`;
    enablePad(false);
    startBtn.disabled = false;
    startBtn.textContent = "다시 시작";

    renderBoard();
    submitToLeaderboard(typed.length, elapsed);
  }

  function clearGame() {
    cancelAnimationFrame(raf);
    phase = "clear";
    const elapsed = Math.max(0, Math.round(performance.now() - startAt));
    kTime.textContent = fmt(elapsed) + " s";

    setBadge("CLEAR!", "gold");
    stateMini.textContent = "상태: 클리어";
    statusLeft.textContent = `클리어! ${TOTAL}자리 전부 맞췄습니다 · ${fmt(elapsed)}s`;
    clearBanner.style.display = "block";
    enablePad(false);
    startBtn.disabled = false;
    startBtn.textContent = "다시 시작";

    renderBoard();
    submitToLeaderboard(typed.length, elapsed);
  }

  function pushDigit(d) {
    if (phase !== "playing") return;

    const expected = PI[typed.length];
    if (d === expected) {
      typed += d;
      setKpi();
      flashBtn(d, "flash-good");
      renderBoard();
      if (typed.length >= TOTAL) {
        clearGame();
      }
    } else {
      flashBtn(d, "flash-bad");
      gameOver(`정답: ${expected}`);
    }
  }

  // ---------- 이벤트 ----------
  pad.addEventListener("click", (e) => {
    const btn = e.target.closest(".pad-btn");
    if (!btn || btn.disabled) return;
    const key = btn.getAttribute("data-key");
    if (key != null) pushDigit(key);
  });

  document.addEventListener("keydown", (e) => {
    if (phase === "ready" || phase === "over" || phase === "clear") {
      if (e.key === "Enter") { e.preventDefault(); start(); }
      return;
    }
    if (phase !== "playing") return;
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      pushDigit(e.key);
    }
  });

  startBtn.addEventListener("click", () => {
    if (phase === "playing") return;
    start();
  });
  resetBtn.addEventListener("click", goReady);

  // ---------- 전체 랭킹 ----------
  const RANK_GAME = "pi_memory";

  function rankFormat(it) {
    const t = (it.secondary / 1000).toFixed(3);
    return `${Math.round(it.primary)} 자리 · ${t}s`;
  }
  function renderRank() {
    if (window.Leaderboard && rankBox) {
      window.Leaderboard.render(rankBox, RANK_GAME, "default", { format: rankFormat });
    }
  }
  async function submitToLeaderboard(digits, timeMs) {
    if (submitted) return;
    submitted = true;
    if (!window.Leaderboard) return;
    await window.Leaderboard.submit(RANK_GAME, {
      mode: "default",
      primary: digits,
      secondary: timeMs,
      meta: { total: TOTAL }
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

  // ---------- init ----------
  goReady();
  renderRank();
})();
