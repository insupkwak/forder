/* 전체 랭킹 헬퍼 (모든 게임 공용)
   - 닉네임은 localStorage(utilweb_nickname)에 보관
   - submit()로 서버에 기록 제출
   - render()로 컨테이너에 TOP N 출력
*/
window.Leaderboard = (function () {
  const NICK_KEY = "utilweb_nickname";

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
      })[c];
    });
  }

  function getStoredNickname() {
    return (localStorage.getItem(NICK_KEY) || "").trim();
  }

  function setStoredNickname(v) {
    const nick = (v || "").trim().slice(0, 16);
    if (nick.length >= 1) {
      localStorage.setItem(NICK_KEY, nick);
      return nick;
    }
    return "";
  }

  function promptNickname() {
    const cur = getStoredNickname();
    const v = prompt("랭킹에 표시될 닉네임을 입력하세요 (1~16자)", cur);
    if (v === null) return cur || "";
    return setStoredNickname(v);
  }

  function ensureNickname() {
    let nick = getStoredNickname();
    if (!nick) nick = promptNickname();
    return nick || "";
  }

  async function submit(game, payload) {
    const nick = ensureNickname();
    if (!nick) return { ok: false, error: "no_nickname" };

    try {
      const r = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game: game,
          mode: payload.mode || "default",
          nickname: nick,
          primary: payload.primary,
          secondary: payload.secondary || 0,
          meta: payload.meta || {}
        })
      });
      return r.ok ? await r.json() : { ok: false };
    } catch (e) {
      return { ok: false, error: "network" };
    }
  }

  async function fetchTop(game, mode, limit) {
    try {
      const url =
        "/api/leaderboard?game=" + encodeURIComponent(game) +
        "&mode=" + encodeURIComponent(mode || "default") +
        "&limit=" + (limit || 20);
      const r = await fetch(url);
      if (!r.ok) return { items: [] };
      return await r.json();
    } catch (e) {
      return { items: [] };
    }
  }

  // 인라인 스타일 (각 게임 페이지 CSS 의존 안 함)
  const ROW_STYLE =
    "display:flex;justify-content:space-between;gap:10px;" +
    "padding:10px 12px;border-radius:12px;" +
    "border:1px solid rgba(255,255,255,0.10);" +
    "background:rgba(0,0,0,0.18);font-size:13px;" +
    "color:rgba(255,255,255,0.92);margin-top:6px;";
  const L_STYLE = "opacity:0.78;flex:1;min-width:0;" +
                  "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
  const R_STYLE = "font-weight:900;white-space:nowrap;";
  const MINE_STYLE = "border-color:rgba(46,204,113,0.55) !important;" +
                     "background:rgba(46,204,113,0.10) !important;";

  function makeRow(leftHtml, rightHtml, mine) {
    const d = document.createElement("div");
    d.setAttribute("style", ROW_STYLE + (mine ? MINE_STYLE : ""));
    d.innerHTML =
      '<div style="' + L_STYLE + '">' + leftHtml + '</div>' +
      '<div style="' + R_STYLE + '">' + rightHtml + '</div>';
    return d;
  }

  /* render(container, game, mode, opts)
     opts.limit      = 20
     opts.format(it) = 표시할 점수 문자열 (default: it.primary)
     opts.title      = 헤더 라벨 (default: "전체 랭킹")
  */
  async function render(container, game, mode, opts) {
    if (!container) return;
    opts = opts || {};
    const limit = opts.limit || 20;
    const format = opts.format || ((it) => String(it.primary));
    const title = opts.title || "전체 랭킹";

    container.innerHTML = "";
    container.appendChild(makeRow(escapeHtml(title), "불러오는 중…", false));

    const data = await fetchTop(game, mode, limit);
    const items = data.items || [];

    container.innerHTML = "";
    if (!items.length) {
      container.appendChild(makeRow(escapeHtml(title), "아직 기록 없음", false));
      return;
    }

    const myNick = getStoredNickname();
    items.forEach(function (it, i) {
      const mine = !!(myNick && it.nickname === myNick);
      const mineLabel = mine ? ' <span style="color:#2ecc71;">(나)</span>' : "";
      const left =
        '#' + (i + 1) + ' · <b>' + escapeHtml(it.nickname) + '</b>' + mineLabel +
        ' · <span style="opacity:0.7;">' + escapeHtml(it.date) + '</span>';
      container.appendChild(makeRow(left, format(it), mine));
    });
  }

  return {
    submit: submit,
    fetchTop: fetchTop,
    render: render,
    getNickname: getStoredNickname,
    setNickname: setStoredNickname,
    promptNickname: promptNickname
  };
})();
