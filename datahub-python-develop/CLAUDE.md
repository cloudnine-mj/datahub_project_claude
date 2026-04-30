# DataHub Python SDK — CLAUDE.md

## 개발 방향 (ADR-001)

현재 Phase 1: Type-B(단순 GCS 버킷) 기반으로 모든 기능 완성.
Type-A(LFS+버전관리)는 실수요 확인 후 Phase 2에서 검토.
신규 기능 구현 시 Type-B 동작 우선 확인. 참고: datahub-governance#119

## 브랜치 전략

- 일상 개발: feature branch → MR target `develop`
- `main` 직접 push 금지
- 에이전트 MR target은 항상 `develop`

## 커밋 규칙

Conventional Commits: `feat:` / `fix:` / `refactor:` / `docs:` / `test:` / `chore:`

## push 전 필수

```bash
git pull --rebase origin develop
```

## 테스트

```bash
pytest tests/ --ignore=tests/e2e
```

## 시크릿 관리

`.env`, `config.py` 등에 token·password 평문 금지.
