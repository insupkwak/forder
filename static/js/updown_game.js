(function () {
  const $ = (id) => document.getElementById(id);

  const levelEl = $("level");
  const newGameBtn = $("newGameBtn");
  const submitBtn = $("submitBtn");
  const pad = $("pad");
  const screen = $("screen");

  const kRange = $("kRange");
  const kTries = $("kTries");
  const kHint = $("kHint");
  const kBest = $("kBest");
  const bestText = $("bestText");

  const statusLeft = $("statusLeft");
  const statusRight = $("statusRight");
  const history = $("history");

  let maxN = 100;
  let target = 0;
  let minBound = 1;
  let maxBound = 100;
  let tries = 0;
  let done = false;
  let input = "";

  function bestKey(n) {
    return "utilweb_updown_best_" + n;
  }

  function getBest(n) {
    const v = localStorage.getItem(bestKey(n));
    return v ? parseInt(v, 10) : null;
  }

  function setBest(n, v) {
    localStorage.setItem(bestKey(n), String(v));
  }

  function fmtRange() {
    kRange.textContent = `${minBound} ~ ${maxBound}`;
  }

function setHint(text) {
  kHint.textContent = text;
  kHint.classList.remove("badge", "up", "down", "correct");

  if (text === "UP") {
    kHint.classList.add("badge", "up");
  } else if (text === "DOWN") {
    kHint.classList.add("badge", "down");
  } else if (text === "정답") {
    kHint.classList.add("badge", "correct");
  }
}


  function setScreen() {
    if (!input) {
      screen.textContent = "숫자 입력";
      screen.classList.add("muted");
      return;
    }
    screen.textContent = input;
    screen.classList.remove("muted");
  }

  function pushRow(label, value) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<div class="l">${label}</div><div class="r">${value}</div>`;
    history.prepend(row);
  }

  function updateBestUI() {
    const b = getBest(maxN);
    const bt = b ? `${b}회` : "-";
    kBest.textContent = bt;
    bestText.textContent = `Best: ${bt} (난이도 ${maxN})`;
  }

  function newGame() {
  maxN = parseInt(levelEl.value, 10);
  target = Math.floor(Math.random() * maxN) + 1;
  minBound = 1;
  maxBound = maxN;
  tries = 0;
  done = false;
  input = "";
  history.innerHTML = "";
  setScreen();
  fmtRange();
  kTries.textContent = "0";
  setHint("-");
  statusLeft.textContent = "숫자를 맞춰보세요.";
  statusRight.textContent = `정답 범위: 1 ~ ${maxN}`;

  // ✅ 확인 버튼 다시 살리기 (필수)
  submitBtn.disabled = false;
  submitBtn.removeAttribute("disabled");
  submitBtn.classList.remove("disabled");
}


  function appendDigit(d) {
    if (done) return;

    const maxLen = String(maxN).length;
    if (input.length >= maxLen) return;

    if (input === "0") input = "";
    input += String(d);
    setScreen();
  }

  function backspace() {
    if (done) return;
    input = input.slice(0, -1);
    setScreen();
  }

  function clearAll() {
    if (done) return;
    input = "";
    setScreen();
  }

  function submit() {
    if (done) return;
    if (!input) return;

    const guess = parseInt(input, 10);

    if (Number.isNaN(guess)) {
      setHint("숫자만 입력");
      return;
    }

    if (guess < 1 || guess > maxN) {
      setHint("범위 밖");
      pushRow(`시도 ${tries + 1}`, `${guess} (범위 밖)`);
      input = "";
      setScreen();
      return;
    }

    if (guess < minBound || guess > maxBound) {
      setHint("범위 밖");
      pushRow(`시도 ${tries + 1}`, `${guess} (범위 밖)`);
      input = "";
      setScreen();
      return;
    }

    tries += 1;
    kTries.textContent = String(tries);

    if (guess === target) {
      done = true;
      setHint("정답");
      pushRow(`시도 ${tries}`, `${guess} (정답)`);
      statusLeft.textContent = `정답입니다. ${tries}회 만에 성공`;
      statusRight.textContent = "새 게임을 눌러 다시 시작하세요.";
      submitBtn.disabled = true;

      const b = getBest(maxN);
      if (!b || tries < b) {
        setBest(maxN, tries);
        updateBestUI();
        pushRow("기록", "Best 갱신");
      }
      submitToLeaderboard(tries);
      return;
    }

    if (guess < target) {
      setHint("UP");
      pushRow(`시도 ${tries}`, `${guess} (UP)`);
      minBound = Math.max(minBound, guess + 1);
      statusLeft.textContent = "UP 입니다.";
    } else {
      setHint("DOWN");
      pushRow(`시도 ${tries}`, `${guess} (DOWN)`);
      maxBound = Math.min(maxBound, guess - 1);
      statusLeft.textContent = "DOWN 입니다.";
    }

    fmtRange();
    input = "";
    setScreen();
  }

  function buildPad() {
    const buttons = [1, 2, 3, 4, 5, 6, 7, 8, 9, "CLR", 0, "←"];
    pad.innerHTML = "";

    buttons.forEach((b) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "num-btn" + (typeof b === "string" ? " util" : "");
      btn.textContent = b;

      btn.addEventListener("click", () => {
        if (b === "CLR") clearAll();
        else if (b === "←") backspace();
        else appendDigit(b);
      });

      pad.appendChild(btn);
    });
  }

  // Enter 키로도 제출 (데스크탑 편의)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
    if (e.key === "Backspace") backspace();
    if (e.key === "Escape") clearAll();
  });

  newGameBtn.addEventListener("click", newGame);
  submitBtn.addEventListener("click", submit);
  levelEl.addEventListener("change", () => { newGame(); renderRank(); });

  // ---- 전체 랭킹 ----
  const RANK_GAME = "updown";
  const rankBox = document.getElementById("globalRank");
  const nickBtn = document.getElementById("changeNickBtn");

  function currentMode(){ return String(maxN); }
  function rankFormat(it){ return `${Math.round(it.primary)} 회`; }
  function renderRank(){
    if (window.Leaderboard && rankBox) {
      window.Leaderboard.render(rankBox, RANK_GAME, currentMode(), { format: rankFormat });
    }
  }
  async function submitToLeaderboard(triesCount){
    if (!window.Leaderboard) return;
    await window.Leaderboard.submit(RANK_GAME, {
      mode: currentMode(),
      primary: triesCount
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

  buildPad();
  newGame();
  renderRank();
})();
