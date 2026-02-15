from flask import Flask, render_template, request, send_file, g
from werkzeug.utils import secure_filename
import re
import sqlite3
from datetime import datetime
import os

from utils_zip import zip_folders_from_paths, zip_files_from_templates

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50MB



# ===========================
# 방문자 카운터 (Total + Today)
# - 기존 visit_log 스키마가 달라도 자동으로 정리
# ===========================
import os
import sqlite3
from datetime import datetime
from flask import g, request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INSTANCE_DIR = os.path.join(BASE_DIR, "instance")
os.makedirs(INSTANCE_DIR, exist_ok=True)

DB_PATH = os.path.join(INSTANCE_DIR, "visit.db")

def get_db():
    if "visit_db" not in g:
        g.visit_db = sqlite3.connect(DB_PATH, timeout=10)
        g.visit_db.row_factory = sqlite3.Row
    return g.visit_db

@app.teardown_appcontext
def close_visit_db(exc):
    conn = g.pop("visit_db", None)
    if conn is not None:
        conn.close()

def table_has_column(conn, table_name, column_name) -> bool:
    rows = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    cols = [r["name"] for r in rows]
    return column_name in cols

def ensure_visit_tables():
    conn = get_db()

    # visit_log가 존재하는지 확인
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='visit_log'"
    ).fetchone()

    if row:
        # 기존 visit_log에 visitor_key 컬럼이 있으면(예전 스키마) -> 드랍하고 새로 생성
        if table_has_column(conn, "visit_log", "visitor_key"):
            conn.execute("DROP TABLE IF EXISTS visit_log")
            conn.commit()

    # 현재 스키마로 생성
    conn.execute("""
        CREATE TABLE IF NOT EXISTS visit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            day TEXT NOT NULL,
            created_at TEXT NOT NULL
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

def count_visit():
    ensure_visit_tables()

    now = datetime.now()
    day = now.strftime("%Y-%m-%d")
    created_at = now.strftime("%Y-%m-%d %H:%M:%S")

    conn = get_db()

    conn.execute("UPDATE visit_stats SET v = v + 1 WHERE k='total_visits'")
    conn.execute("INSERT INTO visit_log(day, created_at) VALUES(?, ?)", (day, created_at))
    conn.commit()

def get_visit_kpis():
    ensure_visit_tables()
    conn = get_db()

    today = datetime.now().strftime("%Y-%m-%d")

    row = conn.execute("SELECT v FROM visit_stats WHERE k='total_visits'").fetchone()
    total_visits = int(row["v"]) if row else 0

    row2 = conn.execute("SELECT COUNT(*) AS c FROM visit_log WHERE day=?", (today,)).fetchone()
    today_visits = int(row2["c"]) if row2 else 0

    return {"total_visits": total_visits, "today_visits": today_visits}

@app.before_request
def visitor_counter():
    if request.path == "/":
        count_visit()






# ===========================
# 라우트
# ===========================
@app.route("/")
def home():
    kpis = get_visit_kpis()
    return render_template("index.html", kpis=kpis)

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

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
