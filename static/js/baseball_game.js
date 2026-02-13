(function () {
  const $ = (id) => document.getElementById(id);

  const guessInput = $("guessInput");
  const submitBtn = $("submitBtn");
  const newGameBtn = $("newGameBtn");
  const statusText = $("statusText");
  const hintText = $("hintText");
  const historyBody = $("historyBody");
  const answerFoot = $("answerFoot");
  const answerText = $("answerText");

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

  function resetGame() {
    answer = makeAnswer();
    tries = 0;
    done = false;

    statusText.textContent = "시도 0회";
    hintText.textContent = "규칙: 0부터 9까지, 서로 다른 숫자 3개";
    guessInput.value = "";
    guessInput.focus();

    historyBody.innerHTML =
      `<tr><td colspan="3" class="td-content" style="color: rgba(255,255,255,0.62);">아직 기록이 없습니다.</td></tr>`;

    answerFoot.style.display = "none";
    answerText.textContent = "";
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

    const guess = (guessInput.value || "").trim();
    const msg = validateGuess(guess);
    if (msg) {
      hintText.textContent = msg;
      return;
    }

    tries += 1;
    const r = judge(guess, answer);

    
function badgeHTML(value, type){
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
    } else {
      statusText.textContent = `시도 ${tries}회`;
    }

    appendHistory(tries, guess, resultText);
    guessInput.value = "";
    guessInput.focus();
    hintText.textContent = "다음 숫자를 입력하세요.";
  }

  submitBtn.addEventListener("click", onSubmit);
  newGameBtn.addEventListener("click", resetGame);

  guessInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") onSubmit();
  });






  

  resetGame();
})();
