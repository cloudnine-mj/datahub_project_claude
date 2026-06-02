"""scope-matrix dump — FastAPI 라우터의 require_scope 부착 현황을 markdown 으로 출력.

architecture/access-tokens.md §2.5 의 정의 그대로:
  > FastAPI app 의 모든 라우터를 순회하며 require_scope dependency 의 metadata
  > 를 markdown 으로 출력. CI 단계에서 architecture/scope-matrix.md 갱신 (drift
  > 방지).

사용:
    # stdout 으로 출력
    python -m app.scripts.dump_scope_matrix

    # 파일과 비교 (CI drift 검사)
    python -m app.scripts.dump_scope_matrix --check architecture/scope-matrix.md

require_scope dependency factory 가 만든 closure 를 식별하기 위해 본 모듈은
factory 호출 시점에 metadata 를 부착하는 약간의 협력이 필요. dependencies.py
의 require_scope 가 _check.__scope__ = (resource_type, min_action) 을 부착함.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import List, Tuple


def _ensure_app_settings() -> None:
    """app.main import 전 필수 환경변수가 비어있으면 최소값으로 채움 (CI 친화)."""
    import secrets

    defaults = {
        "DATABASE_URL": "postgresql://u:p@localhost/d",
        "JWT_SECRET": secrets.token_urlsafe(32),
        "INTERNAL_SERVICE_SECRET": secrets.token_urlsafe(32),
        "GOOGLE_CLIENT_ID": "x",
        "GOOGLE_CLIENT_SECRET": "x",
        "FRONTEND_URL": "http://localhost",
    }
    for k, v in defaults.items():
        os.environ.setdefault(k, v)


def collect_scope_matrix() -> List[Tuple[str, str, str, str]]:
    """FastAPI app 을 import 하여 (method, path, resource_type, min_action) 추출.

    require_scope dependency 에서 부착한 ``__scope__`` 속성으로 식별.
    """
    _ensure_app_settings()
    # 지연 import — 환경변수 setup 이후
    from fastapi.routing import APIRoute

    from app.main import app

    out: List[Tuple[str, str, str, str]] = []
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        scopes: List[Tuple[str, str]] = []
        for dep in route.dependant.dependencies:
            call = dep.call
            scope = getattr(call, "__scope__", None)
            if scope is not None:
                scopes.append(scope)
        if not scopes:
            continue
        for method in sorted(route.methods):
            if method in ("HEAD", "OPTIONS"):
                continue
            for resource_type, min_action in scopes:
                out.append((method, route.path, resource_type, min_action))
    out.sort(key=lambda r: (r[1], r[0]))
    return out


def render_markdown(rows: List[Tuple[str, str, str, str]]) -> str:
    """rows → architecture/scope-matrix.md 본문 markdown."""
    lines = [
        "# Scope Matrix — require_scope 부착 현황 (자동 생성)",
        "",
        "> 본 문서는 `python -m app.scripts.dump_scope_matrix > architecture/scope-matrix.md`",
        "> 으로 datahub-api 의 라우터 정의로부터 자동 생성됩니다.",
        "> 수동 편집 금지 — CI 단계에서 drift 가 감지되면 빌드가 실패합니다.",
        "",
        "## 부착 현황",
        "",
        "| Method | Path | Resource | Min Action |",
        "|--------|------|----------|------------|",
    ]
    for method, path, resource_type, min_action in rows:
        lines.append(f"| `{method}` | `{path}` | `{resource_type}` | `{min_action}` |")
    lines.append("")
    lines.append(f"총 **{len(rows)}** 개 endpoint × scope.")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Dump access-token scope matrix from FastAPI router definitions."
    )
    parser.add_argument(
        "--check",
        type=Path,
        help="비교할 markdown 파일 경로. drift 시 exit code 1.",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="markdown 을 파일로 출력 (default: stdout).",
    )
    args = parser.parse_args()

    rows = collect_scope_matrix()
    md = render_markdown(rows)

    if args.check is not None:
        if not args.check.exists():
            print(f"❌ scope-matrix file not found: {args.check}", file=sys.stderr)
            return 1
        existing = args.check.read_text()
        if existing.strip() != md.strip():
            print(
                "❌ scope-matrix drift detected.\n"
                f"   expected (from app routers): {len(rows)} entries\n"
                f"   regenerate with:\n"
                f"     python -m app.scripts.dump_scope_matrix -o {args.check}",
                file=sys.stderr,
            )
            return 1
        print(f"✅ scope-matrix in sync ({len(rows)} entries)")
        return 0

    if args.output is not None:
        args.output.write_text(md)
        print(f"wrote {len(rows)} entries to {args.output}", file=sys.stderr)
    else:
        sys.stdout.write(md)

    return 0


if __name__ == "__main__":
    sys.exit(main())
