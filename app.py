from flask import Flask, render_template, request, send_file, g
from werkzeug.utils import secure_filename
import re
import sqlite3
from datetime import datetime
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
    conn.execute("INSERT OR IGNORE INTO visit_stats (k, v) VALUES ('total_visits', 0)")
    conn.commit()

def _utc_now():
    return datetime.utcnow()

def _epoch(dt: datetime) -> int:
    return int(dt.timestamp())

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
    - 1시간 쿨다운 통과하면 total/today 증가 + 로그 저장
    - visitor_key / last_ts 쿠키 갱신
    """
    ensure_visit_tables()

    now = _utc_now()
    day = now.strftime("%Y-%m-%d")
    vk = _get_or_make_visitor_key()

    # 1시간 이내 재방문이면 카운트 X, 쿠키만 유지/갱신
    if not should_count_by_cooldown(now):
        resp.set_cookie(VISITOR_COOKIE, vk, max_age=60*60*24*365, samesite="Lax")
        return resp

    conn = visit_db()

    # 전체 방문수 증가
    conn.execute("UPDATE visit_stats SET v = v + 1 WHERE k='total_visits'")

    # 오늘 방문 기록 저장 (visitor_key 포함)
    conn.execute(
        "INSERT INTO visit_log(day, created_at, visitor_key) VALUES(?, ?, ?)",
        (day, now.strftime("%Y-%m-%d %H:%M:%S"), vk)
    )
    conn.commit()

    # 쿠키 설정: visitor_key(1년), last(1시간 쿨다운 기준)
    resp.set_cookie(VISITOR_COOKIE, vk, max_age=60*60*24*365, samesite="Lax")
    resp.set_cookie(VISITOR_LAST_COOKIE, str(_epoch(now)), max_age=COOLDOWN_SECONDS, samesite="Lax")

    return resp

def get_visit_kpis():
    ensure_visit_tables()
    conn = visit_db()

    today = _utc_now().strftime("%Y-%m-%d")

    total_visits = conn.execute(
        "SELECT v FROM visit_stats WHERE k='total_visits'"
    ).fetchone()["v"]

    # today는 "오늘 기록된 로그 수"
    today_visits = conn.execute(
        "SELECT COUNT(*) AS c FROM visit_log WHERE day=?",
        (today,)
    ).fetchone()["c"]

    return {"total_visits": total_visits, "today_visits": today_visits}





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



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
