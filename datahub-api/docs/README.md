# datahub-api Docs

이 디렉토리는 `datahub-api` 저장소 안에서 직접 실행하거나 디버깅해야 하는 API runtime 문서만 둡니다.

Canonical 제품 계약, API 계약, backend 설계, 아키텍처 문서는 `datahub-governance` 저장소를 기준으로 합니다. 과거 storage-engine PoC, Unity Catalog, legacy authorization 조사 문서는 launch-target 구현 기준으로 오해될 수 있어 이 저장소의 `docs/`에서 제거합니다.

## 현재 문서

| 문서 | 역할 |
|------|------|
| [Local API Development](./local-development.md) | Docker Compose 기반 local API 개발 루프 |
| [API Runtime Dependency Matrix](./runtime-dependency-matrix.md) | launch-target runtime 의존성 및 legacy/future boundary |

## 작업 규칙

- API 동작 변경은 `scripts/dev-api smoke`로 실제 hosted local API 요청을 검증합니다.
- MR 설명에는 사용한 local runtime, 포트, smoke 결과, 추가 테스트를 기록합니다.
- Unity Catalog, branch/commit/versioning, `X-API-Key`를 core runtime 계약으로 되살리지 않습니다.
