from flask import Flask, render_template, request, send_file, redirect, url_for
from werkzeug.utils import secure_filename
import re

from utils_zip import zip_folders_from_paths, zip_files_from_templates

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50MB

@app.route("/")
def home():
    return render_template("index.html")

# ---------------------------
# 1) 폴더 트리 만들기
# ---------------------------
@app.route("/folder-builder", methods=["GET", "POST"])
def folder_builder():
    if request.method == "POST":
        tree_text = request.form.get("tree", "")
        root_name = (request.form.get("root_name") or "folder_tree").strip() or "folder_tree"

        # 입력 방식: 한 줄에 한 경로 (슬래시로 하위폴더 표현)
        # 예:
        # docs
        # docs/spec
        # src/app
        lines = [ln.strip() for ln in tree_text.splitlines()]
        # 빈 줄/주석 제거
        paths = []
        for ln in lines:
            if not ln or ln.startswith("#"):
                continue
            # backslash -> slash 통일
            ln = ln.replace("\\", "/")
            # 여러 슬래시 정리
            ln = re.sub(r"/+", "/", ln).strip("/")
            if ln:
                paths.append(ln)

        mem = zip_folders_from_paths(paths, root_name=root_name)

        return send_file(
            mem,
            as_attachment=True,
            download_name=f"{root_name}.zip",
            mimetype="application/zip"
        )

    return render_template("folder_builder.html")

# ---------------------------
# 2) 파일 여러개 만들기
# ---------------------------
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
            # 파일명은 zip 내부 경로로도 쓸 수 있게 허용(예: a/b.txt)
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

        return send_file(
            mem,
            as_attachment=True,
            download_name=f"{root_name}.zip",
            mimetype="application/zip"
        )

    return render_template("file_batch.html")




if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
