(function () {
  const $ = (id) => document.getElementById(id);

  // ---------- DOM ----------
  const displayBox = $("displayBox");
  const inputBox = $("inputBox");
  const statusLeft = $("statusLeft");
  const modeBadge = $("modeBadge");
  const bestText = $("bestText");

  const kRound = $("kRound");
  const kProgress = $("kProgress");
  const kMode = $("kMode");
  const kState = $("kState");

  const startBtn = $("startBtn");
  const submitBtn = $("submitBtn");

  const pad = $("pad");
  const modeSelect = $("modeSelect");
  const scoreTableBody = $("scoreTableBody");

  // ---------- Config ----------
  const SHOW_MS = 1000;       // 한 숫자 표시 시간 (1초)
  const GAP_MS = 200;         // 숫자 사이 짧은 공백
  const COUNT_PER_ROUND = 10; // 한 라운드 숫자 개수

  // ---------- State ----------
  let phase = "ready";        // ready | show | input | over
  let mode = 1;               // 1 | 2 | 3 (자릿수)
  let nums = [];              // 이번 라운드에 보여줄 숫자 배열
  let showIndex = 0;          // 현재 보여주는 인덱스
  let answer = 0;             // 정답 합
  let typed = "";             // 키패드 입력값
  let round = 0;              // 이번 게임에서 진행 중인 라운드 번호 (1부터)
  let clearedRounds = 0;      // 이번 게임에서 맞춘 라운드 수
  let showTimerId = null;

  // ---------- LocalStorage ----------
  function recordKey() {
    return "utilweb_add_challenge_top10";
  }

  function loadRecords() {
    try {
      const raw = localStorage.getItem(recordKey());
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveRecords(list) {
    localStorage.setItem(recordKey(), JSON.stringify(list));
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

  function modeLabel(m) {
    return `${m}자리`;
  }

  function addRecord(modeDigits, roundsCleared) {
    const list = loadRecords();
    list.push({
      ts: Date.now(),
      date: nowStamp(),
      mode: modeDigits,
      rounds: roundsCleared
    });

    list.sort((a, b) => {
      if (b.rounds !== a.rounds) return b.rounds - a.rounds;
      return b.ts - a.ts;
    });

    const top10 = list.slice(0, 10);
    saveRecords(top10);
    renderRecords();
  }

  function renderRecords() {
    if (!scoreTableBody) return;
    const list = loadRecords();

    scoreTableBody.innerHTML = "";
    if (!list.length) {
      scoreTableBody.innerHTML = `<tr><td colspan="4">기록 없음</td></tr>`;
      bestText.textContent = "Best: -";
      return;
    }

    bestText.textContent = `Best: ${list[0].rounds} 라운드 (${modeLabel(list[0].mode)})`;

    list.forEach((r, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${r.date}</td>
        <td>${modeLabel(r.mode)}</td>
        <td>${r.rounds}</td>
      `;
      scoreTableBody.appendChild(tr);
    });
  }

  // ---------- UI Helpers ----------
  function setBadge(text, kind) {
    modeBadge.textContent = text;
    modeBadge.classList.remove("good", "bad");
    if (kind) modeBadge.classList.add(kind);
  }

  function updateKPI() {
    kRound.textContent = String(round);
    if (phase === "show") {
      kProgress.textContent = `${Math.min(showIndex, COUNT_PER_ROUND)} / ${COUNT_PER_ROUND}`;
    } else if (phase === "input") {
      kProgress.textContent = `${COUNT_PER_ROUND} / ${COUNT_PER_ROUND}`;
    } else {
      kProgress.textContent = `0 / ${COUNT_PER_ROUND}`;
    }
    kMode.textContent = modeLabel(mode);
    kState.textContent = phase.toUpperCase();
  }

  function setDisplay(text, small) {
    displayBox.textContent = text;
    displayBox.classList.toggle("small", !!small);
  }

  function setInput(text) {
    inputBox.textContent = text && text.length ? text : "-";
  }

  function enablePad(canType) {
    pad.querySelectorAll("[data-key]").forEach((b) => (b.disabled = !canType));
    pad.querySelectorAll("[data-action]").forEach((b) => (b.disabled = !canType));
    submitBtn.disabled = !canType;
  }

  function setButtonsForPhase() {
    startBtn.disabled = !(phase === "ready" || phase === "over");
    modeSelect.disabled = !(phase === "ready" || phase === "over");
  }

  function clearShowTimer() {
    if (showTimerId) {
      clearTimeout(showTimerId);
      showTimerId = null;
    }
  }

  // ---------- Number Generator ----------
  function randomNumberWithDigits(d) {
    if (d === 1) {
      return Math.floor(Math.random() * 10); // 0~9
    }
    const min = Math.pow(10, d - 1);
    const max = Math.pow(10, d) - 1;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function makeRoundNumbers(d) {
    const arr = [];
    for (let i = 0; i < COUNT_PER_ROUND; i++) {
      arr.push(randomNumberWithDigits(d));
    }
    return arr;
  }

  // ---------- Game Flow ----------
  function goReady() {
    clearShowTimer();
    phase = "ready";
    round = 0;
    clearedRounds = 0;
    nums = [];
    showIndex = 0;
    answer = 0;
    typed = "";

    mode = parseInt(modeSelect.value, 10) || 1;

    setDisplay("READY", false);
    setInput("-");
    setBadge("READY", null);
    statusLeft.textContent = "모드를 선택하고 시작을 누르세요.";

    enablePad(false);
    updateKPI();
    setButtonsForPhase();
  }

  function startRound() {
    clearShowTimer();
    phase = "show";
    typed = "";
    setInput("-");

    round += 1;
    nums = makeRoundNumbers(mode);
    answer = nums.reduce((a, b) => a + b, 0);
    showIndex = 0;

    setBadge("MEMORIZE", null);
    statusLeft.textContent = `라운드 ${round} · 숫자 ${COUNT_PER_ROUND}개를 1초씩 보여드립니다.`;
    enablePad(false);
    updateKPI();
    setButtonsForPhase();

    showNext();
  }

  function showNext() {
    if (showIndex >= COUNT_PER_ROUND) {
      // 모두 보여줌 → 짧은 공백 후 입력 단계
      setDisplay("?", false);
      showTimerId = setTimeout(() => {
        startInput();
      }, GAP_MS);
      return;
    }

    setDisplay(String(nums[showIndex]), false);
    showIndex += 1;
    updateKPI();

    showTimerId = setTimeout(() => {
      // 짧은 공백 (다음 숫자가 같으면 변화가 안 보이는 걸 방지)
      setDisplay("·", false);
      showTimerId = setTimeout(showNext, GAP_MS);
    }, SHOW_MS - GAP_MS);
  }

  function startInput() {
    phase = "input";
    typed = "";
    setInput("-");

    setDisplay("합을 입력하세요", true);
    setBadge("INPUT", null);
    statusLeft.textContent = `더한 값을 키패드로 입력하고 확인을 누르세요.`;

    enablePad(true);
    updateKPI();
    setButtonsForPhase();
  }

  function success() {
    clearedRounds = round;

    setBadge("CORRECT", "good");
    statusLeft.textContent = `정답입니다. (합 ${answer}) · 다음 라운드로 진행합니다.`;
    setDisplay(`정답: ${answer}`, true);

    enablePad(false);
    updateKPI();
    setButtonsForPhase();

    setTimeout(() => {
      startRound();
    }, 900);
  }

  function gameOver(userValue) {
    clearShowTimer();
    phase = "over";

    enablePad(false);
    setBadge("GAME OVER", "bad");

    if (clearedRounds > 0) {
      statusLeft.textContent =
        `틀렸습니다. 입력: ${userValue} / 정답: ${answer}. ` +
        `클리어 라운드: ${clearedRounds}`;
      addRecord(mode, clearedRounds);
      submitToLeaderboard(mode, clearedRounds);
    } else {
      statusLeft.textContent =
        `틀렸습니다. 입력: ${userValue} / 정답: ${answer}. 기록이 없습니다.`;
    }

    setDisplay(`정답: ${answer}`, true);
    updateKPI();
    setButtonsForPhase();
  }

  function submit() {
    if (phase !== "input") return;
    if (typed.length < 1) {
      statusLeft.textContent = "합을 입력하세요.";
      return;
    }
    const v = parseInt(typed, 10);
    if (Number.isNaN(v)) {
      statusLeft.textContent = "숫자를 입력하세요.";
      return;
    }
    if (v === answer) success();
    else gameOver(v);
  }

  // ---------- Input Handling ----------
  function pushDigit(d) {
    if (phase !== "input") return;
    // 최대 5자리(999*10=9990) → 안전하게 6자리까지 허용
    if (typed.length >= 6) return;
    if (typed === "0") typed = d;
    else typed += d;
    setInput(typed);
  }

  function backspace() {
    if (phase !== "input") return;
    typed = typed.slice(0, -1);
    setInput(typed);
  }

  function clearAll() {
    if (phase !== "input") return;
    typed = "";
    setInput("-");
  }

  pad.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || btn.disabled) return;

    const key = btn.getAttribute("data-key");
    const act = btn.getAttribute("data-action");

    if (key != null) pushDigit(key);
    else if (act === "back") backspace();
    else if (act === "clr") clearAll();
  });

  document.addEventListener("keydown", (e) => {
    if (phase === "ready" || phase === "over") {
      if (e.key === "Enter") {
        e.preventDefault();
        startGame();
      }
      return;
    }

    if (phase !== "input") return;

    if (e.key >= "0" && e.key <= "9") {
      pushDigit(e.key);
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      backspace();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      clearAll();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
      return;
    }
  });

  function startGame() {
    mode = parseInt(modeSelect.value, 10) || 1;
    round = 0;
    clearedRounds = 0;
    startRound();
  }

  startBtn.addEventListener("click", () => {
    if (!(phase === "ready" || phase === "over")) return;
    startGame();
  });

  submitBtn.addEventListener("click", submit);

  modeSelect.addEventListener("change", () => {
    if (phase === "ready" || phase === "over") {
      mode = parseInt(modeSelect.value, 10) || 1;
      updateKPI();
    }
  });

  // ---------- 전체 랭킹 연동 ----------
  const RANK_GAME = "add_challenge";
  const rankBox = document.getElementById("globalRank");
  const nickBtn = document.getElementById("changeNickBtn");
  const rankTabs = document.querySelectorAll(".rankTab");
  let rankViewMode = "1";

  function rankFormat(it) {
    return `${Math.round(it.primary)} 라운드`;
  }

  function setRankTabActive(modeStr) {
    rankTabs.forEach((b) => {
      const isActive = b.getAttribute("data-rankmode") === modeStr;
      b.style.background = isActive
        ? "linear-gradient(135deg, rgba(52,152,219,0.42), rgba(52,152,219,0.18))"
        : "rgba(255,255,255,0.04)";
      b.style.borderColor = isActive
        ? "rgba(52,152,219,0.65)"
        : "rgba(255,255,255,0.16)";
    });
  }

  function renderRank() {
    if (window.Leaderboard && rankBox) {
      window.Leaderboard.render(rankBox, RANK_GAME, rankViewMode, {
        format: rankFormat,
        title: `전체 랭킹 (${modeLabel(parseInt(rankViewMode, 10))})`
      });
    }
  }

  async function submitToLeaderboard(modeDigits, rounds) {
    if (!window.Leaderboard) return;
    await window.Leaderboard.submit(RANK_GAME, {
      mode: String(modeDigits),
      primary: rounds,
      meta: { mode: modeLabel(modeDigits) }
    });
    if (String(modeDigits) === rankViewMode) renderRank();
  }

  rankTabs.forEach((b) => {
    b.addEventListener("click", () => {
      rankViewMode = b.getAttribute("data-rankmode");
      setRankTabActive(rankViewMode);
      renderRank();
    });
  });

  if (nickBtn) {
    nickBtn.addEventListener("click", () => {
      if (window.Leaderboard) {
        window.Leaderboard.promptNickname();
        renderRank();
      }
    });
  }

  // ---------- init ----------
  function init() {
    renderRecords();
    goReady();
    setRankTabActive(rankViewMode);
    renderRank();
  }

  init();
})();
