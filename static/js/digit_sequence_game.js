(function () {
  const $ = (id) => document.getElementById(id);

  // ---------- DOM ----------
  const displayBox = $("displayBox");      // 큰 표시(숫자/메시지)
  const inputBox = $("inputBox");          // 입력 표시(키패드 입력값)
  const statusLeft = $("statusLeft");      // 상태 문구
  const modeBadge = $("modeBadge");        // 배지(READY/MEMORIZE/INPUT/...)

  const bestText = $("bestText");          // Best Stage 표시

  const kStage = $("kStage");              // KPI: 단계(자리수)
  const kTimer = $("kTimer");              // KPI: 카운트다운
  const kState = $("kState");              // KPI: 상태

  const startBtn = $("startBtn");          // 시작(초록)
  const skipBtn = $("skipBtn");            // 스킵(노랑)
  const submitBtn = $("submitBtn");        // 확인(파랑)

  const pad = $("pad");                    // 숫자 패드
  const scoreTableBody = $("scoreTableBody");

  // ---------- Config ----------
  const SHOW_SECONDS = 10;   // 보여주는 시간
  const START_DIGITS = 5;    // 시작 자리수

  // ---------- State ----------
  let phase = "ready";       // ready | show | input | over
  let digits = START_DIGITS;
  let answer = "";
  let typed = "";
  let secondsLeft = SHOW_SECONDS;
  let timerId = null;

  // 성공한 최고 단계(자리수) - 이번 게임에서 맞춘 마지막 단계
  let clearedStage = 0;

  // ---------- LocalStorage (Top10) ----------
  function recordKey() {
    return "utilweb_digit_sequence_top10";
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

  function addRecord(stageDigits) {
    const list = loadRecords();
    list.push({ ts: Date.now(), date: nowStamp(), stage: stageDigits });

    // 단계 내림차순, 동점이면 최신 우선
    list.sort((a, b) => {
      if (b.stage !== a.stage) return b.stage - a.stage;
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
      scoreTableBody.innerHTML = `<tr><td colspan="3">기록 없음</td></tr>`;
      bestText.textContent = "Best Stage: -";
      return;
    }

    bestText.textContent = `Best Stage: ${list[0].stage}`;

    list.forEach((r, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${r.date}</td>
        <td>${r.stage}</td>
      `;
      scoreTableBody.appendChild(tr);
    });
  }

  // ---------- UI Helpers ----------
  function setBadge(text, mode) {
    modeBadge.textContent = text;
    modeBadge.classList.remove("good", "bad");
    if (mode) modeBadge.classList.add(mode);
  }

  function updateKPI() {
    kStage.textContent = String(digits);
    kTimer.textContent = phase === "show" ? `${secondsLeft}s` : "-";
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

  function clearTimer() {
    if (timerId) clearInterval(timerId);
    timerId = null;
  }

  function setButtonsForPhase() {
    // 시작은 ready/over에서 가능
    startBtn.disabled = !(phase === "ready" || phase === "over");

    // 스킵은 show 단계에서만 가능
    skipBtn.disabled = !(phase === "show");

    // 패드/확인은 input에서만 enablePad(true)로 켜짐
  }

  // ---------- Number Generator ----------
  function makeNumberString(n) {
    let s = "";
    for (let i = 0; i < n; i++) s += String(Math.floor(Math.random() * 10));
    return s;
  }

  // ---------- Game Flow ----------
  function goReady() {
    clearTimer();
    phase = "ready";
    digits = START_DIGITS;
    answer = "";
    typed = "";
    secondsLeft = SHOW_SECONDS;
    clearedStage = 0;

    setDisplay("READY", false);
    setInput("-");
    setBadge("READY", null);
    statusLeft.textContent = "시작을 누르세요.";

    enablePad(false);
    updateKPI();
    setButtonsForPhase();
  }

  function startShow() {
    clearTimer();
    phase = "show";
    typed = "";
    setInput("-");

    answer = makeNumberString(digits);
    secondsLeft = SHOW_SECONDS;

    setDisplay(answer, false);
    setBadge("MEMORIZE", null);
    statusLeft.textContent = `${SHOW_SECONDS}초 동안 숫자를 외우세요. (스킵 가능)`;

    enablePad(false);
    updateKPI();
    setButtonsForPhase();

    timerId = setInterval(() => {
      secondsLeft -= 1;
      updateKPI();

      if (secondsLeft <= 0) {
        clearTimer();
        startInput();
      }
    }, 1000);
  }

  function startInput() {
    phase = "input";
    typed = "";
    setInput("-");

    setDisplay("입력하세요", true);
    setBadge("INPUT", null);
    statusLeft.textContent = `${digits}자리를 입력하고 확인을 누르세요.`;

    enablePad(true);
    updateKPI();
    setButtonsForPhase();
  }

  function success() {
    // 이번 digits를 성공했다
    clearedStage = digits;

    setBadge("CORRECT", "good");
    statusLeft.textContent = `정답입니다. 다음 단계는 ${digits + 1}자리입니다.`;

    // 다음 단계
    digits += 1;
    enablePad(false);
    updateKPI();
    setButtonsForPhase();

    // 잠깐 텀 후 다음 show
    setTimeout(() => {
      startShow();
    }, 650);
  }

  function gameOver() {
    clearTimer();
    phase = "over";

    enablePad(false);
    setButtonsForPhase();

    setBadge("GAME OVER", "bad");

    if (clearedStage > 0) {
      statusLeft.textContent = `틀렸습니다. 최고 단계는 ${clearedStage}자리입니다.`;
      addRecord(clearedStage);
      submitToLeaderboard(clearedStage);
    } else {
      statusLeft.textContent = "틀렸습니다. 기록이 없습니다.";
    }

    setDisplay(`정답: ${answer}`, true);
    updateKPI();
  }

  function submit() {
    if (phase !== "input") return;

    if (typed.length !== digits) {
      statusLeft.textContent = `${digits}자리를 입력하세요.`;
      return;
    }

    if (typed === answer) success();
    else gameOver();
  }

  // ---------- Input Handling ----------
  function pushDigit(d) {
    if (phase !== "input") return;
    if (typed.length >= digits) return;
    typed += d;
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

  // pad click
  pad.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || btn.disabled) return;

    const key = btn.getAttribute("data-key");
    const act = btn.getAttribute("data-action");

    if (key != null) pushDigit(key);
    else if (act === "back") backspace();
    else if (act === "clr") clearAll();
  });

  // keyboard support (PC 테스트)
  document.addEventListener("keydown", (e) => {
    if (phase === "ready" || phase === "over") {
      if (e.key === "Enter") {
        e.preventDefault();
        startShow();
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

  // ---------- Buttons ----------
  startBtn.addEventListener("click", () => {
    if (!(phase === "ready" || phase === "over")) return;
    startShow();
  });

  skipBtn.addEventListener("click", () => {
    if (phase !== "show") return;
    clearTimer();
    startInput();
  });

  submitBtn.addEventListener("click", submit);

  // ---------- 전체 랭킹 연동 ----------
  const RANK_GAME = "digit_sequence";
  const rankBox = document.getElementById("globalRank");
  const nickBtn = document.getElementById("changeNickBtn");

  function rankFormat(it) {
    return `${Math.round(it.primary)} 자리`;
  }
  function renderRank() {
    if (window.Leaderboard && rankBox) {
      window.Leaderboard.render(rankBox, RANK_GAME, "default", { format: rankFormat });
    }
  }
  async function submitToLeaderboard(stage) {
    if (!window.Leaderboard) return;
    await window.Leaderboard.submit(RANK_GAME, {
      mode: "default",
      primary: stage
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
  function init() {
    renderRecords();
    goReady();
    renderRank();
  }

  init();
})();
