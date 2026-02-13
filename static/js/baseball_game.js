(function () {
  const $ = (id) => document.getElementById(id);

  // 기존 요소
  const submitBtn = $("submitBtn");
  const newGameBtn = $("newGameBtn");
  const statusText = $("statusText");
  const hintText = $("hintText");
  const historyBody = $("historyBody");
  const answerFoot = $("answerFoot");
  const answerText = $("answerText");

  // 새로 추가된 버튼 입력 UI 요소 (HTML에 넣은 것)
  const pad = $("pad");
  const pickRow = $("pickRow");

  // 선택된 숫자 (버튼으로 입력)
  const picked = [];
  const buttons = new Map(); // digit -> button

  let answer = "";
  let tries = 0;
  let done = false;

  function makeAnswer() {
    const digits = [];
    while (digits.length < 3) {
      const d = Math.floor(Math.random() * 10);
      if (!digits.includes(d)) digits.push(d);
    }
    return digits.join("");
  }

  function resetPicked() {
    picked.length = 0;
    renderPicked();
  }

  function renderPicked() {
    if (!pickRow) return;

    const slots = pickRow.querySelectorAll(".slot");
    for (let i = 0; i < 3; i++) {
      slots[i].textContent = picked[i] ?? "_";
    }

    // 이미 선택된 숫자는 비활성화
    for (let d = 0; d <= 9; d++) {
      const b = buttons.get(d);
      if (b) b.disabled = picked.includes(d);
    }
  }

function buildPad() {
  if (!pad) return;

  pad.innerHTML = "";
  buttons.clear();

  const layout = [1,2,3,4,5,6,7,8,9,"empty",0,"empty"];

  layout.forEach((item) => {
    if (item === "empty") {
      const spacer = document.createElement("div");
      spacer.style.width = "56px";
      spacer.style.height = "56px";
      pad.appendChild(spacer);
      return;
    }

    const b = document.createElement("button");
    b.type = "button";
    b.className = "num-btn";
    b.textContent = String(item);

    b.addEventListener("click", () => {
      if (done) return;
      if (picked.length >= 3) return;
      if (picked.includes(item)) return;

      picked.push(item);
      renderPicked();
      hintText.textContent = "확인을 눌러 결과를 확인하세요.";
    });

    pad.appendChild(b);
    buttons.set(item, b);
  });

  renderPicked();
}


  function resetGame() {
    answer = makeAnswer();
    tries = 0;
    done = false;

    statusText.textContent = "시도 0회";
    hintText.textContent = "규칙: 0부터 9까지, 서로 다른 숫자 3개";

    historyBody.innerHTML =
      `<tr><td colspan="3" class="td-content" style="color: rgba(255,255,255,0.62);">아직 기록이 없습니다.</td></tr>`;

    answerFoot.style.display = "none";
    answerText.textContent = "";

    resetPicked();
    renderPicked();
  }

  function validateGuess(s) {
    if (!/^\d{3}$/.test(s)) return "3자리 숫자만 입력하세요.";
    const a = s.split("");
    const set = new Set(a);
    if (set.size !== 3) return "중복 없는 3자리 숫자를 입력하세요.";
    return "";
  }

  function judge(guess, ans) {
    let strike = 0;
    let ball = 0;
    for (let i = 0; i < 3; i++) {
      if (guess[i] === ans[i]) strike++;
      else if (ans.includes(guess[i])) ball++;
    }
    const out = 3 - strike - ball;
    return { strike, ball, out };
  }

  function appendHistory(n, guess, resultText) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${n}</td>
      <td><b>${guess}</b></td>
      <td class="td-content">${resultText}</td>
    `;

    if (tries === 1) historyBody.innerHTML = "";
    historyBody.appendChild(tr);
  }

  function onSubmit() {
    if (done) return;

    // 버튼으로 고른 값 -> 3자리 문자열
    if (picked.length !== 3) {
      hintText.textContent = "숫자 버튼으로 3자리를 먼저 선택하세요.";
      return;
    }

    const guess = picked.join("");
    const msg = validateGuess(guess);
    if (msg) {
      hintText.textContent = msg;
      return;
    }

    tries += 1;
    const r = judge(guess, answer);

    function badgeHTML(value, type) {
      const zeroClass = value === 0 ? "zero" : type;
      return `<span class="badge ${zeroClass}">${value} ${type.toUpperCase()}</span>`;
    }

    let resultText = `
      <div class="result-badges">
        ${badgeHTML(r.strike, "s")}
        ${badgeHTML(r.ball, "b")}
        ${badgeHTML(r.out, "o")}
      </div>
    `;

    if (r.strike === 3) {
      resultText = `정답! ${r.strike}S`;
      done = true;
      answerFoot.style.display = "block";
      answerText.textContent = answer;
      statusText.textContent = `정답입니다. 총 ${tries}회`;
      hintText.textContent = "게임 종료! 새 게임을 눌러 다시 시작하세요.";
    } else {
      statusText.textContent = `시도 ${tries}회`;
      hintText.textContent = "다음 숫자를 선택하세요.";
    }

    appendHistory(tries, guess, resultText);

    // 다음 입력을 위해 선택 초기화
    resetPicked();
  }

  submitBtn.addEventListener("click", onSubmit);
  newGameBtn.addEventListener("click", () => {
    resetGame();
  });

  // 최초 실행
  buildPad();
  resetGame();
})();
