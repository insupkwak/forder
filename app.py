from flask import Flask, render_template, request, send_file, g, jsonify
from werkzeug.utils import secure_filename
import re
import json
import sqlite3
import hashlib
import logging
from datetime import datetime, timezone, timedelta
import os
from flask import render_template, make_response

from utils_zip import zip_folders_from_paths, zip_files_from_templates

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50MB



# ===========================
# 방문자 카운터 (Total + Today) + 1시간 쿨다운
# - 동일 브라우저(쿠키) 기준으로 1시간 내 재방문은 카운트 X
# ===========================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INSTANCE_DIR = os.path.join(BASE_DIR, "instance")
os.makedirs(INSTANCE_DIR, exist_ok=True)

VISIT_DB_PATH = os.path.join(INSTANCE_DIR, "visit.db")

VISITOR_COOKIE = "vw_visitor"         # visitor_key 저장
VISITOR_LAST_COOKIE = "vw_last"       # 마지막 카운트 시각(UTC epoch) 저장
COOLDOWN_SECONDS = 3600               # 1시간

# "오늘" 기준 시간대 (한국 표준시 UTC+9)
LOCAL_TZ = timezone(timedelta(hours=9))

# 봇/크롤러 User-Agent 패턴 (소문자 매칭)
BOT_UA_PATTERNS = (
    "bot", "crawler", "spider", "scraper",
    "curl", "wget", "python-requests", "okhttp", "httpclient", "httpx",
    "headlesschrome", "phantomjs", "selenium", "puppeteer", "playwright",
    "lighthouse", "pagespeed", "pingdom", "uptimerobot", "monitor",
    "googlebot", "bingbot", "yandex", "duckduckbot", "baiduspider",
    "facebookexternalhit", "slackbot", "twitterbot", "discordbot",
    "ahrefsbot", "semrushbot", "mj12bot", "dotbot",
)

# IP 해싱용 솔트 (서버마다 고유하게 두면 더 안전하나, 단일 인스턴스라 상수로 충분)
IP_HASH_SALT = "forder-visit-ip-v1"

def _is_bot_ua(ua: str) -> bool:
    """User-Agent가 봇/크롤러로 보이면 True. 빈 UA도 봇으로 간주."""
    if not ua or len(ua.strip()) < 4:
        return True
    low = ua.lower()
    return any(p in low for p in BOT_UA_PATTERNS)

def _client_ip() -> str:
    """프록시(gunicorn + nginx) 뒤에 있을 수 있어 X-Forwarded-For 우선."""
    fwd = request.headers.get("X-Forwarded-For", "")
    if fwd:
        # 첫 번째가 클라이언트 IP
        return fwd.split(",")[0].strip()
    return request.remote_addr or ""

def _hash_ip(ip: str) -> str:
    """IP를 솔트 + SHA256로 해시. 앞 16자만 저장(중복 식별에 충분)."""
    if not ip:
        return ""
    return hashlib.sha256((IP_HASH_SALT + "|" + ip).encode("utf-8")).hexdigest()[:16]

def visit_db():
    if "visit_db" not in g:
        g.visit_db = sqlite3.connect(VISIT_DB_PATH, timeout=10)
        g.visit_db.row_factory = sqlite3.Row
    return g.visit_db

@app.teardown_appcontext
def close_visit_db(exc):
    conn = g.pop("visit_db", None)
    if conn:
        conn.close()

def ensure_visit_tables():
    conn = visit_db()
    conn.execute("""
      CREATE TABLE IF NOT EXISTS visit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day TEXT NOT NULL,
        created_at TEXT NOT NULL,
        visitor_key TEXT NOT NULL
      )
    """)
    conn.execute("""
      CREATE TABLE IF NOT EXISTS visit_stats (
        k TEXT PRIMARY KEY,
        v INTEGER NOT NULL
      )
    """)

    # 기존 DB에 ip_hash / user_agent 컬럼 없으면 추가 (마이그레이션)
    existing_cols = {r[1] for r in conn.execute("PRAGMA table_info(visit_log)").fetchall()}
    if "ip_hash" not in existing_cols:
        conn.execute("ALTER TABLE visit_log ADD COLUMN ip_hash TEXT NOT NULL DEFAULT ''")
    if "user_agent" not in existing_cols:
        conn.execute("ALTER TABLE visit_log ADD COLUMN user_agent TEXT NOT NULL DEFAULT ''")

    # 인덱스 (오늘 카운트 + visitor_key 기반 쿨다운 조회 성능)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_visit_log_day ON visit_log(day)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_visit_log_vkey ON visit_log(visitor_key)")

    conn.execute("INSERT OR IGNORE INTO visit_stats (k, v) VALUES ('total_visits', 0)")
    conn.commit()

def _utc_now():
    return datetime.now(timezone.utc)

def _epoch(dt: datetime) -> int:
    return int(dt.timestamp())

def _local_day(dt_utc: datetime) -> str:
    """UTC datetime을 한국 표준시 기준 날짜 문자열(YYYY-MM-DD)로 변환."""
    return dt_utc.astimezone(LOCAL_TZ).strftime("%Y-%m-%d")

def _get_or_make_visitor_key():
    # 쿠키 없으면 새 키 발급
    vk = request.cookies.get(VISITOR_COOKIE)
    if vk and len(vk) >= 16:
        return vk
    # 충분히 랜덤한 키
    return os.urandom(16).hex()

def should_count_by_cooldown(now_utc: datetime) -> bool:
    """
    쿠키에 저장된 마지막 카운트 시각(vw_last)이 1시간 이내면 카운트하지 않음.
    """
    last_s = request.cookies.get(VISITOR_LAST_COOKIE)
    if not last_s:
        return True
    try:
        last_epoch = int(last_s)
    except ValueError:
        return True

    return (_epoch(now_utc) - last_epoch) >= COOLDOWN_SECONDS

def count_visit_if_needed(resp):
    """
    홈(/) 접속 시 호출:
    - 봇/크롤러는 카운트 안 함
    - 1시간 쿨다운(쿠키 + DB 양쪽) 통과해야 카운트
    - DB 오류가 나도 절대 페이지를 죽이지 않음
    """
    try:
        ensure_visit_tables()

        ua = request.headers.get("User-Agent", "")
        # 1) 봇/크롤러는 카운트 제외
        if _is_bot_ua(ua):
            app.logger.info("skip bot visit: %s", ua[:80])
            return resp

        now = _utc_now()
        day = _local_day(now)             # ✅ KST 기준 "오늘"
        vk = _get_or_make_visitor_key()

        # 2) 쿠키 기반 1시간 쿨다운
        if not should_count_by_cooldown(now):
            resp.set_cookie(VISITOR_COOKIE, vk, max_age=60*60*24*365, samesite="Lax")
            return resp

        # 3) DB 기반 1시간 쿨다운 (쿠키 우회 봇/스크래퍼 차단)
        conn = visit_db()
        last_row = conn.execute(
            "SELECT created_at FROM visit_log WHERE visitor_key=? ORDER BY id DESC LIMIT 1",
            (vk,)
        ).fetchone()
        if last_row:
            try:
                last_dt = datetime.strptime(last_row["created_at"], "%Y-%m-%d %H:%M:%S")
                last_dt = last_dt.replace(tzinfo=LOCAL_TZ)
                if (now - last_dt).total_seconds() < COOLDOWN_SECONDS:
                    # 1시간 이내 같은 visitor_key가 이미 기록됨 → 카운트 안 함
                    resp.set_cookie(VISITOR_COOKIE, vk, max_age=60*60*24*365, samesite="Lax")
                    resp.set_cookie(
                        VISITOR_LAST_COOKIE,
                        str(int(last_dt.timestamp())),
                        max_age=COOLDOWN_SECONDS,
                        samesite="Lax"
                    )
                    return resp
            except ValueError:
                pass  # 파싱 실패하면 그냥 진행

        # 4) 카운트 진행
        ip_hash = _hash_ip(_client_ip())
        conn.execute("UPDATE visit_stats SET v = v + 1 WHERE k='total_visits'")
        conn.execute(
            "INSERT INTO visit_log(day, created_at, visitor_key, ip_hash, user_agent) "
            "VALUES(?, ?, ?, ?, ?)",
            (day, now.astimezone(LOCAL_TZ).strftime("%Y-%m-%d %H:%M:%S"), vk, ip_hash, ua[:200])
        )
        conn.commit()

        resp.set_cookie(VISITOR_COOKIE, vk, max_age=60*60*24*365, samesite="Lax")
        resp.set_cookie(VISITOR_LAST_COOKIE, str(_epoch(now)), max_age=COOLDOWN_SECONDS, samesite="Lax")
    except Exception as e:
        app.logger.warning("count_visit_if_needed failed: %s", e)
    return resp

def get_visit_kpis():
    """방문 KPI 조회. DB 오류 시 0으로 fallback."""
    try:
        ensure_visit_tables()
        conn = visit_db()

        today = _local_day(_utc_now())    # ✅ KST 기준 "오늘"

        row = conn.execute(
            "SELECT v FROM visit_stats WHERE k='total_visits'"
        ).fetchone()
        total_visits = row["v"] if row else 0

        today_visits = conn.execute(
            "SELECT COUNT(*) AS c FROM visit_log WHERE day=?",
            (today,)
        ).fetchone()["c"]

        return {"total_visits": total_visits, "today_visits": today_visits}
    except Exception as e:
        app.logger.warning("get_visit_kpis failed: %s", e)
        return {"total_visits": 0, "today_visits": 0}


# ===========================
# 게임 기록 공유 랭킹 (scores)
# - 각 게임 종료 시 클라이언트가 POST /api/score 로 제출
# - GET /api/leaderboard 로 게임별 TOP N 조회
# ===========================

# 정렬 방향 정의:
#   asc       : primary 낮을수록 좋음
#   desc      : primary 높을수록 좋음
#   asc_desc  : primary 낮을수록, 동률시 secondary 높을수록
#   desc_asc  : primary 높을수록, 동률시 secondary 낮을수록
GAME_DIRECTIONS = {
    "baseball":       "asc",       # 시도 횟수 적게
    "capital_quiz":   "desc",      # 점수 높게
    "digit_sequence": "desc",      # 외운 자리수 크게
    "memory_capital": "asc",       # 클리어 시간 짧게 (동률시 moves 적게)
    "memory_numbers": "desc_asc",  # 맞춘 수 많게, 시간 짧게
    "number_order":   "asc",       # 시간 짧게
    "pattern_memory": "desc_asc",  # 성공 라운드 많게, 시간 짧게
    "pi_memory":      "desc_asc",  # 맞춘 자리수 크게, 시간 짧게
    "reaction":       "asc",       # 평균 반응속도 짧게
    "target":         "desc",      # 점수 높게
    "timing":         "asc",       # 오차 작게
    "updown":         "asc",       # 시도 횟수 적게
    "add_challenge":  "desc",      # 클리어 라운드 많게
}

_ORDER_BY_SQL = {
    "asc":      "primary_value ASC,  secondary_value ASC,  id ASC",
    "desc":     "primary_value DESC, secondary_value DESC, id ASC",
    "asc_desc": "primary_value ASC,  secondary_value DESC, id ASC",
    "desc_asc": "primary_value DESC, secondary_value ASC,  id ASC",
}

def ensure_scores_table():
    conn = visit_db()
    conn.execute("""
      CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'default',
        nickname TEXT NOT NULL,
        visitor_key TEXT NOT NULL,
        primary_value REAL NOT NULL,
        secondary_value REAL NOT NULL DEFAULT 0,
        meta TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_scores_game_mode ON scores(game, mode)")
    conn.commit()

def _clean_str(v, maxlen):
    if v is None:
        return ""
    s = str(v).strip()
    return s[:maxlen]

@app.route("/api/score", methods=["POST"])
def api_score():
    ensure_scores_table()
    data = request.get_json(silent=True) or {}

    game     = _clean_str(data.get("game"), 32)
    mode     = _clean_str(data.get("mode") or "default", 32) or "default"
    nickname = _clean_str(data.get("nickname"), 16)

    if game not in GAME_DIRECTIONS:
        return jsonify({"ok": False, "error": "unknown_game"}), 400
    if len(nickname) < 1:
        return jsonify({"ok": False, "error": "nickname_required"}), 400

    try:
        primary = float(data.get("primary"))
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "bad_primary"}), 400
    try:
        secondary = float(data.get("secondary") or 0)
    except (TypeError, ValueError):
        secondary = 0.0

    meta = data.get("meta") or {}
    try:
        meta_str = json.dumps(meta, ensure_ascii=False)[:512]
    except (TypeError, ValueError):
        meta_str = "{}"

    vk = _get_or_make_visitor_key()
    now = _utc_now().strftime("%Y-%m-%d %H:%M:%S")

    conn = visit_db()
    conn.execute(
        "INSERT INTO scores(game, mode, nickname, visitor_key, primary_value, secondary_value, meta, created_at) "
        "VALUES(?,?,?,?,?,?,?,?)",
        (game, mode, nickname, vk, primary, secondary, meta_str, now)
    )
    conn.commit()

    resp = make_response(jsonify({"ok": True}))
    resp.set_cookie(VISITOR_COOKIE, vk, max_age=60*60*24*365, samesite="Lax")
    return resp

@app.route("/api/leaderboard")
def api_leaderboard():
    ensure_scores_table()
    game = _clean_str(request.args.get("game"), 32)
    mode = _clean_str(request.args.get("mode") or "default", 32) or "default"
    try:
        limit = int(request.args.get("limit") or 20)
    except ValueError:
        limit = 20
    limit = max(1, min(100, limit))

    if game not in GAME_DIRECTIONS:
        return jsonify({"items": []})

    order_sql = _ORDER_BY_SQL[GAME_DIRECTIONS[game]]
    conn = visit_db()
    rows = conn.execute(
        f"SELECT nickname, primary_value, secondary_value, meta, created_at "
        f"FROM scores WHERE game=? AND mode=? ORDER BY {order_sql} LIMIT ?",
        (game, mode, limit)
    ).fetchall()

    items = []
    for r in rows:
        try:
            meta = json.loads(r["meta"]) if r["meta"] else {}
        except (TypeError, ValueError):
            meta = {}
        items.append({
            "nickname":  r["nickname"],
            "primary":   r["primary_value"],
            "secondary": r["secondary_value"],
            "meta":      meta,
            "date":      r["created_at"]
        })
    return jsonify({"items": items})





# ===========================
# 라우트
# ===========================
@app.route("/")
def home():
    kpis = get_visit_kpis()
    resp = make_response(render_template("index.html", kpis=kpis))
    resp = count_visit_if_needed(resp)
    return resp

@app.route("/folder-builder", methods=["GET", "POST"])
def folder_builder():
    if request.method == "POST":
        tree_text = request.form.get("tree", "")
        root_name = (request.form.get("root_name") or "folder_tree").strip() or "folder_tree"

        lines = [ln.strip() for ln in tree_text.splitlines()]
        paths = []
        for ln in lines:
            if not ln or ln.startswith("#"):
                continue
            ln = ln.replace("\\", "/")
            ln = re.sub(r"/+", "/", ln).strip("/")
            if ln:
                paths.append(ln)

        mem = zip_folders_from_paths(paths, root_name=root_name)
        return send_file(mem, as_attachment=True, download_name=f"{root_name}.zip", mimetype="application/zip")

    return render_template("folder_builder.html")

@app.route("/file-batch", methods=["GET", "POST"])
def file_batch():
    if request.method == "POST":
        root_name = (request.form.get("root_name") or "files").strip() or "files"
        names_text = request.form.get("names", "")
        target_names = []
        for ln in names_text.splitlines():
            ln = ln.strip()
            if not ln or ln.startswith("#"):
                continue
            ln = ln.replace("\\", "/").lstrip("/")
            target_names.append(ln)

        uploads = request.files.getlist("files")
        templates = []
        for f in uploads:
            if not f or not f.filename:
                continue
            original = secure_filename(f.filename)
            data = f.read()
            if data is None:
                continue
            templates.append((original, data))

        mem = zip_files_from_templates(templates, target_names, root_name=root_name)
        return send_file(mem, as_attachment=True, download_name=f"{root_name}.zip", mimetype="application/zip")

    return render_template("file_batch.html")

@app.route("/baseball-game", methods=["GET"])
def baseball_game():
    return render_template("baseball_game.html")

@app.route("/capital-quiz", methods=["GET"])
def capital_quiz():
    return render_template("capital_quiz.html")

@app.route("/memory-capital")
def memory_capital():
    return render_template("memory_capital.html")


@app.route("/reaction-game")
def reaction_game():
    return render_template("reaction_game.html")


@app.route("/timing-game")
def timing_game():
    return render_template("timing_game.html")

@app.route("/number-order")
def number_order():
    return render_template("number_order.html")


@app.route("/memory-numbers")
def memory_numbers():
    return render_template("memory_numbers.html")

@app.route("/pattern-memory")
def pattern_memory():
    return render_template("pattern_memory.html")

@app.route("/updown")
def updown_game():
    return render_template("updown_game.html", page_title="업앤다운")

@app.route("/target")
def target_game():
    return render_template("target_game.html", page_title="타겟 맞추기")


@app.route("/digit-sequence")
def digit_sequence():
    return render_template("digit_sequence_game.html", page_title="숫자 외우기")


@app.route("/add-challenge")
def add_challenge():
    return render_template("add_challenge.html", page_title="더하기 챌린지")


# ===========================
# 원주율 외우기 (1000자리)
# Spigot algorithm (Rabinowitz/Wagon)으로 서버 기동시 1회 계산
# ===========================
def _compute_pi_digits(n):
    """n자리 만큼의 pi 숫자열을 반환 (선행 3 포함)."""
    k, a, b, a1, b1 = 2, 4, 1, 12, 4
    out = []
    while len(out) < n:
        p, q, k = k * k, 2 * k + 1, k + 1
        a, b, a1, b1 = a1, b1, p * a + q * a1, p * b + q * b1
        d, d1 = a // b, a1 // b1
        while d == d1 and len(out) < n:
            out.append(str(d))
            a, a1 = 10 * (a % b), 10 * (a1 % b1)
            d, d1 = a // b, a1 // b1
    return "".join(out[:n])

PI_TOTAL_DIGITS = 1000  # 소수부 자리수
# 선행 "3"을 제외한 1000자리 소수부 ("1415926535...")
PI_DECIMALS = _compute_pi_digits(PI_TOTAL_DIGITS + 1)[1:]

@app.route("/pi-memory")
def pi_memory():
    return render_template(
        "pi_memory.html",
        page_title="원주율 외우기",
        pi_decimals=PI_DECIMALS,
        pi_total=PI_TOTAL_DIGITS
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
