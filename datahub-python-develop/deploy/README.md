# datahub-python SDK — 릴리즈 및 배포 가이드

## 개요

`datahub-python`은 Kubernetes에 배포되는 서비스가 아닌 Python 패키지(SDK)입니다.
GitLab Package Registry에 PyPI 패키지로 배포됩니다.

## 패키지 정보

- **패키지명**: `datahub`
- **현재 버전**: `0.8.4` (pyproject.toml 기준)
- **레지스트리**: `https://gitlab.lgresearch.ai/data-governance-public/datahub-python`

## 로컬 빌드

```bash
# 의존성 설치
pip install build uv

# 빌드
python -m build

# 결과물
ls dist/
# datahub-0.8.4-py3-none-any.whl
# datahub-0.8.4.tar.gz
```

## 릴리즈 절차

SDK는 **git 태그 기반**으로 자동 빌드·배포됩니다 (`.gitlab-ci.yml` 참조).

> ⚠️ 현재 GitLab Runner 미설정 상태 — 태그 트리거 파이프라인 동작 여부 확인 필요

### 수동 배포 방법 (Runner 없을 경우)

```bash
# 1. 버전 업데이트 (pyproject.toml)
# version = "0.9.0"

# 2. 빌드
python -m build

# 3. GitLab Package Registry에 배포
TWINE_PASSWORD=<GITLAB_TOKEN> TWINE_USERNAME=<GITLAB_USERNAME> \
python -m twine upload \
  --repository-url https://gitlab.lgresearch.ai/api/v4/projects/$(glab repo view --json id -q .id)/packages/pypi \
  dist/*
```

### 설치 방법 (사용자)

```bash
pip install lgair-datahub \
  --extra-index-url https://gitlab.lgresearch.ai/api/v4/projects/883/packages/pypi/simple \
  --trusted-host gitlab.lgresearch.ai
```

> 자세한 설치 방법은 [README.md](../README.md) 참조

## 테스트

```bash
# 단위 테스트
pytest tests/

# 특정 테스트
pytest tests/test_client.py -v
```

## 담당자

| 역할 | 담당 |
|------|------|
| SDK 개발·릴리즈 | 시우 (datahub-backend), 도윤 (datahub-qa) |
| 품질 검증 | 도윤 (datahub-qa) |
| DX 피드백 | 하린 (datahub-tester) |
