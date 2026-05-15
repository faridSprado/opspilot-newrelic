from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECRET_PATTERNS = [
    re.compile(r"NRAK-[A-Za-z0-9_\-]{8,}"),
    re.compile(r"OPENAI_API_KEY\s*=\s*sk-[A-Za-z0-9_\-]{8,}"),
    re.compile(r"NEW_RELIC_API_KEY\s*=\s*NRAK-[A-Za-z0-9_\-]{8,}"),
    re.compile(r"AIza[0-9A-Za-z_\-]{20,}"),
    re.compile(r"GEMINI_API_KEY\s*=\s*AIza[0-9A-Za-z_\-]{20,}"),
]
SKIP_DIRS = {".git", "node_modules", ".next", ".venv", "__pycache__"}


def iter_files():
    for path in ROOT.rglob("*"):
        if path.is_dir() or any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".zip"}:
            continue
        yield path


def main() -> int:
    failures = []
    for path in iter_files():
        text = path.read_text(encoding="utf-8", errors="ignore")
        for pattern in SECRET_PATTERNS:
            if pattern.search(text):
                failures.append(str(path.relative_to(ROOT)))
    if failures:
        print("Potential hardcoded secrets found:")
        for item in failures:
            print(f"- {item}")
        return 1
    print("No hardcoded New Relic/OpenAI/Gemini secrets detected.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
