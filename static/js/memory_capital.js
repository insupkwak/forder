(function () {
  const $ = (id) => document.getElementById(id);

  const board = $("board");
  const kpiTime = $("kpiTime");
  const kpiMoves = $("kpiMoves");
  const kpiMatched = $("kpiMatched");
  const statusText = $("statusText");
  const doneText = $("doneText");

  const startBtn = $("startBtn");
  const restartBtn = $("restartBtn");
  const difficultySelect = $("difficultySelect");

  const FLAG_BASE = "https://flagcdn.com/w160/";

  // ✅ 최소 50개 이상 권장 (10x10이면 50쌍 필요)
  const DATA = [
    { code: "kr" }, { code: "jp" }, { code: "cn" }, { code: "us" },
    { code: "gb" }, { code: "fr" }, { code: "de" }, { code: "it" },
    { code: "es" }, { code: "ca" }, { code: "au" }, { code: "br" },
    { code: "mx" }, { code: "in" }, { code: "th" }, { code: "vn" },
    { code: "sg" }, { code: "tr" }, { code: "eg" }, { code: "za" },
    { code: "ar" }, { code: "cl" }, { code: "co" }, { code: "pe" },
    { code: "uy" }, { code: "py" }, { code: "bo" }, { code: "ch" },
    { code: "nl" }, { code: "be" }, { code: "at" }, { code: "pt" },
    { code: "gr" }, { code: "pl" }, { code: "cz" }, { code: "hu" },
    { code: "dk" }, { code: "no" }, { code: "se" }, { code: "fi" },
    { code: "ie" }, { code: "ro" }, { code: "bg" }, { code: "ru" },
    { code: "ua" }, { code: "hr" }, { code: "sk" }, { code: "si" },
    { code: "ee" }, { code: "lv" }, { code: "lt" }, { code: "is" },
    { code: "nz" }, { code: "id" }, { code: "ph" }, { code: "my" },
    { code: "pk" }, { code: "bd" }, { code: "np" }, { code: "mn" },
    { code: "sa" }, { code: "ae" }, { code: "qa" }, { code: "il" },
    { code: "ir" }, { code: "iq" }, { code: "jo" }, { code: "ng" },
    { code: "ke" }, { code: "et" }, { code: "gh" }, { code: "ma" },
    { code: "tn" }, { code: "tz" }, { code: "ug" }
  ];

  // ===== 상태 =====
  let grid = 10;
  let pairs = 50;
  let tiles = [];

  let started = false;
  let locked = false;
  let firstId = null;
  let secondId = null;

  let moves = 0;
  let matched = 0;

  let t0 = 0;
  let timer = null;

  function setStatus(msg) {
    if (statusText) statusText.textContent = msg;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function startTimer() {
    stopTimer();
    t0 = Date.now();
    timer = setInterval(() => {
      const ms = Date.now() - t0;
      const s = Math.floor(ms / 1000);
      const mm = String(Math.floor(s / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      kpiTime.textContent = `${mm}:${ss}`;
    }, 300);
  }

function applyDifficulty() {
  grid = Number(difficultySelect.value); // 4, 6, 8, 10만 들어옴
  board.style.gridTemplateColumns = `repeat(${grid}, 1fr)`;

  const totalCards = grid * grid;   // 항상 짝수
  pairs = totalCards / 2;           // 정확히 2장씩 짝
}

  function updateKPI() {
    kpiMoves.textContent = String(moves);
    kpiMatched.textContent = `${matched} / ${pairs}`;
  }

  function buildDeck() {
  if (DATA.length < pairs) {
    setStatus(`국가 데이터가 부족합니다. 필요: ${pairs}개, 현재: ${DATA.length}개`);
    return false;
  }

  // ✅ chosen 1개당 2장씩 -> totalCards 정확히 맞음
  const chosen = shuffle(DATA).slice(0, pairs);
  const deck = [];

  chosen.forEach((p) => {
    deck.push({ code: p.code });
    deck.push({ code: p.code });
  });

  // ✅ 완전 셔플
  const shuffled = shuffle(deck);

  // ✅ 검증: 모든 code가 정확히 2장씩인지
  const count = {};
  for (const x of shuffled) count[x.code] = (count[x.code] || 0) + 1;
  const ok = Object.values(count).every(v => v === 2);
  if (!ok) {
    setStatus("덱 생성 오류(짝 검증 실패). 다시 섞기 해주세요.");
    return false;
  }

  tiles = shuffled.map((x, i) => ({
    id: i,
    code: x.code,
    key: x.code,
    matched: false
  }));

  return true;
}

  function renderBoard() {
    doneText.style.display = "none";
    doneText.textContent = "";

    board.innerHTML = tiles.map((t) => {
      const img = `${FLAG_BASE}${t.code}.png`;
      return `
        <div class="card-tile" data-id="${t.id}">
          <div class="card-inner">
            <div class="card-face front">
              <div class="mark"></div>
            </div>
            <div class="card-face back">
              <img class="flag" src="${img}" alt="${t.code}" loading="lazy">
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function flip(id, on) {
    const el = board.querySelector(`.card-tile[data-id="${id}"]`);
    if (!el) return;
    el.classList.toggle("is-flipped", !!on);
  }

  function markMatched(id) {
    const el = board.querySelector(`.card-tile[data-id="${id}"]`);
    if (!el) return;
    el.classList.add("is-matched");
  }

  function finish() {
    stopTimer();
    started = false;
    setStatus("🎉 완료!");
    doneText.style.display = "block";
    const elapsedMs = Date.now() - t0;
    doneText.textContent = `완료! 시도 ${moves}회 · ${(elapsedMs/1000).toFixed(1)}s`;
    submitToLeaderboard(elapsedMs);
  }

  function onTileClick(e) {
    const tileEl = e.target.closest(".card-tile");
    if (!tileEl) return;
    if (!started) return;
    if (locked) return;

    const id = Number(tileEl.dataset.id);
    if (Number.isNaN(id)) return;
    if (!tiles[id] || tiles[id].matched) return;
    if (id === firstId) return;

    flip(id, true);

    if (firstId === null) {
      firstId = id;
      return;
    }

    secondId = id;
    locked = true;

    moves += 1;
    updateKPI();

    const ok = tiles[firstId].key === tiles[secondId].key;

    if (ok) {
      tiles[firstId].matched = true;
      tiles[secondId].matched = true;
      markMatched(firstId);
      markMatched(secondId);

      matched += 1;
      updateKPI();

      firstId = null;
      secondId = null;
      locked = false;

      if (matched >= pairs) finish();
      return;
    }

    setTimeout(() => {
      flip(firstId, false);
      flip(secondId, false);
      firstId = null;
      secondId = null;
      locked = false;
    }, 650);
  }

  function startGame() {
    // ✅ 버튼 눌렀는데 안 시작되는 원인은 여기서 에러로 끊기는 경우가 많음
    try {
      applyDifficulty();

      moves = 0;
      matched = 0;
      firstId = null;
      secondId = null;
      locked = false;

      kpiTime.textContent = "00:00";
      updateKPI();

      const ok = buildDeck();
      if (!ok) return;

      renderBoard();
      started = true;
      setStatus(`게임 시작! (${grid}x${grid})`);

      startTimer();
    } catch (err) {
      setStatus("시작 오류: " + (err?.message || err));
      console.error(err);
    }
  }

  function restartGame() {
    stopTimer();
    started = false;

    moves = 0;
    matched = 0;
    firstId = null;
    secondId = null;
    locked = false;

    kpiTime.textContent = "00:00";
    updateKPI();
    setStatus("다시 섞기 완료. 게임 시작을 누르세요.");

    applyDifficulty();
    const ok = buildDeck();
    if (!ok) return;
    renderBoard();

    doneText.style.display = "none";
    doneText.textContent = "";
  }

  // ===== 이벤트 연결 =====
  board.addEventListener("click", onTileClick);
  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", restartGame);

  // ===== 전체 랭킹 =====
  const RANK_GAME = "memory_capital";
  const rankBox = document.getElementById("globalRank");
  const nickBtn = document.getElementById("changeNickBtn");

  function currentMode() {
    return `${grid}x${grid}`;
  }
  function rankFormat(it) {
    const m = it.meta || {};
    const t = (it.primary / 1000).toFixed(1);
    return `${t}s · ${m.moves != null ? m.moves : Math.round(it.secondary)}회`;
  }
  function renderRank() {
    if (window.Leaderboard && rankBox) {
      window.Leaderboard.render(rankBox, RANK_GAME, currentMode(), { format: rankFormat });
    }
  }
  async function submitToLeaderboard(timeMs) {
    if (!window.Leaderboard) return;
    await window.Leaderboard.submit(RANK_GAME, {
      mode: currentMode(),
      primary: timeMs,
      secondary: moves,
      meta: { moves: moves, grid: grid }
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
  difficultySelect.addEventListener("change", () => {
    // 난이도가 바뀌면 해당 모드의 랭킹으로 전환 (restartGame이 grid를 갱신)
    setTimeout(renderRank, 0);
  });

  // ✅ 초기 화면: 설정값 기준으로 “섞어둔 보드”만 미리 보여주기
  restartGame();
  renderRank();
})();
