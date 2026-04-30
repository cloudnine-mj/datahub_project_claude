"""DataHub SDK 기본 endpoint 결정.

우선순위:
  1. **Wheel 배포 (PyPI)**: CI 가 빌드 전에 이 파일을 브랜치별 고정값으로
     전체 overwrite → 이 모듈의 로직은 사라지고 `DEFAULT_ENDPOINT = "..."`
     한 줄만 남음 (.gitlab-ci.yml 의 `.build_common` 참고).
  2. **Editable install / git clone**: 파일이 원본 상태 그대로라면 import
     시점에 현재 git 브랜치를 감지해 자동으로 해당 환경 endpoint 사용.
     develop → dev, staging → stg, main → prd, 그 외 → prd fallback.
  3. **런타임 override**: env `DATAHUB_AUTH_ENDPOINT` 또는
     `~/.datahub/config.yaml` 의 `auth.endpoint` 가 항상 최우선 (config.py).
     여기서 결정된 DEFAULT_ENDPOINT 는 override 없을 때만 쓰임.

CI 의 overwrite 는 이 파일의 전체 내용을 `DEFAULT_ENDPOINT = "<env-url>"`
한 줄로 치환하는 방식이라, 아래 runtime 감지 로직은 wheel 에서는 존재하지
않게 되어 I/O 오버헤드·호환성 문제 모두 없음.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

_BRANCH_ENDPOINTS: dict[str, str] = {
    "develop": "https://api-dev.datahub.lgair-data.com",
    "staging": "https://api-stg.datahub.lgair-data.com",
    "main":    "https://api.datahub.lgair-data.com",
}
_PRD_FALLBACK = "https://api.datahub.lgair-data.com"


def _current_git_branch() -> Optional[str]:
    """현재 체크아웃된 git 브랜치 이름. detached HEAD / .git 없음 → None.

    서브프로세스를 피하고 `.git/HEAD` 를 직접 읽어 import 비용 최소화.
    """
    try:
        # src/datahub/_defaults.py → parents[0]=datahub → [1]=src → [2]=repo_root
        repo_root = Path(__file__).resolve().parents[2]
        head = (repo_root / ".git" / "HEAD").read_text().strip()
    except (OSError, ValueError):
        return None

    prefix = "ref: refs/heads/"
    if head.startswith(prefix):
        return head[len(prefix):]
    # detached HEAD (raw SHA) 또는 기타 형식
    return None


def _resolve_default_endpoint() -> str:
    branch = _current_git_branch()
    if branch is not None:
        return _BRANCH_ENDPOINTS.get(branch, _PRD_FALLBACK)
    return _PRD_FALLBACK


DEFAULT_ENDPOINT = _resolve_default_endpoint()
