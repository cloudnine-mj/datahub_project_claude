# Scope Matrix — require_scope 부착 현황 (자동 생성)

> 본 문서는 `python -m app.scripts.dump_scope_matrix > architecture/scope-matrix.md`
> 으로 datahub-api 의 라우터 정의로부터 자동 생성됩니다.
> 수동 편집 금지 — CI 단계에서 drift 가 감지되면 빌드가 실패합니다.

## 부착 현황

| Method | Path | Resource | Min Action |
|--------|------|----------|------------|
| `POST` | `/api/v1/lfs/{group}/{repo_name}/objects/batch` | `repo` | `write` |
| `DELETE` | `/api/v1/repos/{group}/{repo_name}` | `repo` | `delete` |
| `GET` | `/api/v1/repos/{group}/{repo_name}` | `repo` | `read` |
| `GET` | `/api/v1/repos/{group}/{repo_name}/branches` | `repo` | `read` |
| `POST` | `/api/v1/repos/{group}/{repo_name}/branches` | `repo` | `write` |
| `DELETE` | `/api/v1/repos/{group}/{repo_name}/branches/{name}` | `repo` | `write` |
| `GET` | `/api/v1/repos/{group}/{repo_name}/commits` | `repo` | `read` |
| `GET` | `/api/v1/repos/{group}/{repo_name}/content` | `repo` | `read` |
| `POST` | `/api/v1/repos/{group}/{repo_name}/copy/stream/commit` | `repo` | `write` |
| `POST` | `/api/v1/repos/{group}/{repo_name}/copy/stream/open` | `repo` | `write` |
| `POST` | `/api/v1/repos/{group}/{repo_name}/copy/stream/page` | `repo` | `write` |
| `GET` | `/api/v1/repos/{group}/{repo_name}/diff` | `repo` | `read` |
| `POST` | `/api/v1/repos/{group}/{repo_name}/download/stream/open` | `repo` | `read` |
| `POST` | `/api/v1/repos/{group}/{repo_name}/download/stream/page` | `repo` | `read` |
| `POST` | `/api/v1/repos/{group}/{repo_name}/lfs/commits` | `repo` | `write` |
| `GET` | `/api/v1/repos/{group}/{repo_name}/ls` | `repo` | `read` |
| `POST` | `/api/v1/repos/{group}/{repo_name}/merge` | `repo` | `write` |
| `GET` | `/api/v1/repos/{group}/{repo_name}/permissions` | `repo` | `read` |
| `PUT` | `/api/v1/repos/{group}/{repo_name}/permissions` | `repo` | `admin` |
| `DELETE` | `/api/v1/repos/{group}/{repo_name}/permissions/{email}` | `repo` | `admin` |
| `GET` | `/api/v1/repos/{group}/{repo_name}/stats` | `repo` | `read` |
| `GET` | `/api/v1/repos/{group}/{repo_name}/token` | `repo` | `read` |
| `POST` | `/api/v1/repos/{group}/{repo_name}/token` | `repo` | `read` |
| `PATCH` | `/api/v1/repos/{group}/{repo_name}/visibility` | `repo` | `admin` |
| `DELETE` | `/api/v1/repos/{repo_name}` | `repo` | `delete` |
| `GET` | `/api/v1/repos/{repo_name}` | `repo` | `read` |
| `GET` | `/api/v1/repos/{repo_name}/stats` | `repo` | `read` |
| `PATCH` | `/api/v1/repos/{repo_name}/visibility` | `repo` | `admin` |
| `GET` | `/api/v1/repos/{repo}/branches` | `repo` | `read` |
| `POST` | `/api/v1/repos/{repo}/branches` | `repo` | `write` |
| `DELETE` | `/api/v1/repos/{repo}/branches/{name}` | `repo` | `write` |
| `GET` | `/api/v1/repos/{repo}/commits` | `repo` | `read` |
| `POST` | `/api/v1/repos/{repo}/commits` | `repo` | `write` |
| `GET` | `/api/v1/repos/{repo}/content` | `repo` | `read` |
| `GET` | `/api/v1/repos/{repo}/diff` | `repo` | `read` |
| `POST` | `/api/v1/repos/{repo}/download` | `repo` | `read` |
| `POST` | `/api/v1/repos/{repo}/download/stream/open` | `repo` | `read` |
| `POST` | `/api/v1/repos/{repo}/download/stream/page` | `repo` | `read` |
| `POST` | `/api/v1/repos/{repo}/lfs/commits` | `repo` | `write` |
| `POST` | `/api/v1/repos/{repo}/lfs/objects/batch` | `repo` | `write` |
| `GET` | `/api/v1/repos/{repo}/lineage` | `repo` | `read` |
| `POST` | `/api/v1/repos/{repo}/lineage` | `repo` | `write` |
| `DELETE` | `/api/v1/repos/{repo}/lineage/{lineage_id}` | `repo` | `write` |
| `GET` | `/api/v1/repos/{repo}/ls` | `repo` | `read` |
| `POST` | `/api/v1/repos/{repo}/merge` | `repo` | `write` |
| `POST` | `/api/v1/repos/{repo}/migrate` | `repo` | `admin` |
| `GET` | `/api/v1/repos/{repo}/permissions` | `repo` | `read` |
| `PUT` | `/api/v1/repos/{repo}/permissions` | `repo` | `admin` |
| `DELETE` | `/api/v1/repos/{repo}/permissions/{email}` | `repo` | `admin` |
| `GET` | `/api/v1/repos/{repo}/token` | `repo` | `read` |
| `POST` | `/api/v1/repos/{repo}/token` | `repo` | `read` |

총 **51** 개 endpoint × scope.
