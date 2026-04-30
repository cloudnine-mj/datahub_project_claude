"""DataHub SDK 기본 endpoint.

로컬 개발 기본값은 `http://localhost:8000` 입니다. 실제 환경(dev/stg/prd)에서는
다음 중 하나로 override 하세요 (config.py 가 이미 지원):

  1. 환경변수: `DATAHUB_AUTH_ENDPOINT=https://api.example.com`
  2. 설정 파일: `~/.datahub/config.yaml` 의 `auth.endpoint`
  3. 생성자 인자: `DataClient(endpoint="https://...")`

CI 빌드(.gitlab-ci.yml `.build_common`)는 이 파일 전체를 브랜치별 endpoint
한 줄로 overwrite 하므로, wheel 배포본에는 아래 값이 그대로 남지 않습니다.
"""

from __future__ import annotations

DEFAULT_ENDPOINT = "http://localhost:8000"
