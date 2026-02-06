import io
import os
import zipfile
from pathlib import Path

def zip_folders_from_paths(paths: list[str], root_name: str = "folder_tree") -> io.BytesIO:
    """
    paths: ["a/b/c", "a/d", "x/y"] 형태의 폴더 경로 리스트
    """
    mem = io.BytesIO()
    with zipfile.ZipFile(mem, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for p in paths:
            p = p.strip().strip("/").strip("\\")
            if not p:
                continue
            # ZIP에서 폴더는 trailing slash로 엔트리 생성
            zip_dir = f"{root_name}/{p}/"
            z.writestr(zip_dir, "")
    mem.seek(0)
    return mem

def zip_files_from_templates(
    templates: list[tuple[str, bytes]],
    target_names: list[str],
    root_name: str = "files"
) -> io.BytesIO:
    """
    규칙:
    - 첨부 파일 확장자를 기본 확장자로 사용
    - target 이름에 확장자가 없으면 자동으로 붙임
    - target 이름에 확장자가 있으면 그대로 사용
    - 템플릿 1개면 전부 복제
    - 템플릿 여러개 + target 개수 동일하면 순서 매칭
    """
    mem = io.BytesIO()
    if not templates or not target_names:
        return mem

    # 기준 확장자 (첫 번째 첨부 파일)
    base_ext = ""
    first_name = templates[0][0]
    if "." in first_name:
        base_ext = "." + first_name.rsplit(".", 1)[1]

    use_mode = "single"
    if len(templates) == len(target_names):
        use_mode = "pair"

    with zipfile.ZipFile(mem, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for i, raw_name in enumerate(target_names):
            name = (raw_name or "").strip().lstrip("/").lstrip("\\")
            if not name:
                continue

            # 확장자 자동 보정
            if "." not in name.split("/")[-1] and base_ext:
                name = name + base_ext

            if use_mode == "pair":
                src_bytes = templates[i][1]
            else:
                src_bytes = templates[0][1]

            z.writestr(f"{root_name}/{name}", src_bytes)

    mem.seek(0)
    return mem

