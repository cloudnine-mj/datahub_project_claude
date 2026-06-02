# DataHub API — CLAUDE.md

## 개발 방향 (ADR-001)

현재 Phase 1: GCS object storage 기반 control-plane 계약으로 모든 기능 완성.
저장소 버전 관리 PoC는 launch-target 구현에서 제외한다.
신규 기능 구현 시 repository-first 계약을 우선 확인. 참고: datahub-governance#119

## 브랜치 전략

- 일상 개발: feature branch → MR target **항상 `develop`**. develop merge 시 dev 환경 자동 배포.
- `staging` 배포: develop → staging fast-forward (또는 merge commit) 로 promote. **개별 feature MR 을 staging 으로 직접 target 하지 않는다** — feature 단위 stg 배포는 금지. 항상 develop 의 통합 snapshot 을 promote 하는 모델.
- `main` 직접 push 금지 (prd 배포 트리거). main 으로의 promote 도 staging → main 머지로만, 사용자 명시 요청 시에만.
- 에이전트 MR target 은 항상 `develop`.
- 표준 배포 사이클: **`/code-release` skill** (fetch → feat → MR target=develop → CI → merge → dev 배포 → post-deploy smoke → `/dev-record`). 큰 작업 시작 전 **`/dev-plan`** 으로 계획서 작성 + 사용자 승인 게이트 통과.

## 커밋 규칙

Conventional Commits: `feat:` / `fix:` / `refactor:` / `docs:` / `test:` / `chore:`

## push 전 필수

```bash
git pull --rebase origin develop
```

## 로컬 API 개발 환경

API 동작 변경은 단위 테스트만으로 완료하지 않는다. 기본 루프는 실제 FastAPI 서버와 PostgreSQL을 띄운 뒤 HTTP 요청으로 검증한다.

```bash
scripts/dev-api up
scripts/dev-api migrate
scripts/dev-api server
scripts/dev-api smoke
```

Docker 안에서 API까지 실행할 때는 다음을 사용한다.

```bash
scripts/dev-api api-up
scripts/dev-api smoke
```

기본 포트는 API `18080`, PostgreSQL `15432`, Redis `16379`다. 같은 머신의 다른 작업과 충돌하면 포트를 하드코딩하지 말고 환경 변수로 바꾼다.

```bash
DATAHUB_DEV_API_PORT=18081 scripts/dev-api server
DATAHUB_DEV_POSTGRES_PORT=15433 DATAHUB_DEV_REDIS_PORT=16380 scripts/dev-api up
DATAHUB_DEV_COMPOSE_PROJECT=datahub-api-dev-<name> scripts/dev-api api-up
```

MR 설명에는 이 환경에서 수행한 검증 명령, 사용 포트, 실패/미수행 사유를 반드시 기록한다. 템플릿은 `.gitlab/merge_request_templates/default.md`를 따른다.

Launch-target local profile에서는 storage-engine PoC, Unity Catalog, MCP를 core dependency로 추가하지 않는다. 런타임 의존성 기준은 `docs/runtime-dependency-matrix.md`를 따른다.

## develop K8s 배포 기준

`develop` 배포 경로도 local launch-target과 같은 경계를 따른다. API deploy는 FastAPI platform service, Redis, 공유 PostgreSQL `platform_db`를 core로 보고 Unity Catalog, MCP endpoint는 기본 비활성화한다.

CI/Helm 변경 시 storage-engine PoC 또는 Unity Catalog 비밀번호/access key를 필수 변수로 되살리지 않는다. rollout 후에는 hosted pod의 `/api/v1/health`와 `MCP_ENABLED=false`를 확인하고 MR에 기록한다.

## 시크릿 관리

values.yaml / config 파일에 token·password·API key 평문 금지.
GitLab CI/CD Variables 또는 Kubernetes Secrets 사용.
