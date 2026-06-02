# Scope Matrix — require_scope 부착 현황 (자동 생성)

> 본 문서는 `python -m app.scripts.dump_scope_matrix > architecture/scope-matrix.md`
> 으로 datahub-api 의 라우터 정의로부터 자동 생성됩니다.
> 수동 편집 금지 — CI 단계에서 drift 가 감지되면 빌드가 실패합니다.

## 부착 현황

| Method | Path | Resource | Min Action |
|--------|------|----------|------------|
| `GET` | `/api/v1/repos/search` | `repo` | `read` |
| `DELETE` | `/api/v1/repos/{group}/{repo_name}` | `repo` | `delete` |
| `GET` | `/api/v1/repos/{group}/{repo_name}` | `repo` | `read` |
| `GET` | `/api/v1/repos/{group}/{repo_name}/metadata` | `repo` | `read` |
| `PATCH` | `/api/v1/repos/{group}/{repo_name}/metadata` | `repo` | `write` |
| `GET` | `/api/v1/repos/{group}/{repo_name}/metadata/tags` | `repo` | `read` |
| `POST` | `/api/v1/repos/{group}/{repo_name}/metadata/tags` | `repo` | `write` |
| `DELETE` | `/api/v1/repos/{group}/{repo_name}/metadata/tags/{tag}` | `repo` | `write` |
| `POST` | `/api/v1/repos/{group}/{repo_name}/metadata/validate` | `repo` | `write` |
| `PATCH` | `/api/v1/repos/{group}/{repo_name}/name` | `repo` | `admin` |
| `GET` | `/api/v1/repos/{group}/{repo_name}/permissions` | `repo` | `admin` |
| `PUT` | `/api/v1/repos/{group}/{repo_name}/permissions` | `repo` | `admin` |
| `DELETE` | `/api/v1/repos/{group}/{repo_name}/permissions/{email}` | `repo` | `admin` |
| `GET` | `/api/v1/repos/{group}/{repo_name}/stats` | `repo` | `read` |
| `PATCH` | `/api/v1/repos/{group}/{repo_name}/visibility` | `repo` | `admin` |
| `GET` | `/api/v1/repos/{group}/{repo}/lineage` | `repo` | `read` |
| `POST` | `/api/v1/repos/{group}/{repo}/lineage` | `repo` | `write` |
| `DELETE` | `/api/v1/repos/{group}/{repo}/lineage/{lineage_id}` | `repo` | `write` |
| `GET` | `/api/v1/repos/{owner}/{repo}/files` | `repo` | `read` |
| `POST` | `/api/v1/repos/{owner}/{repo}/files/confirm` | `repo` | `write` |
| `GET` | `/api/v1/repos/{owner}/{repo}/files/content` | `repo` | `read` |
| `POST` | `/api/v1/repos/{owner}/{repo}/files/copy` | `repo` | `write` |
| `POST` | `/api/v1/repos/{owner}/{repo}/files/download-token` | `repo` | `read` |
| `GET` | `/api/v1/repos/{owner}/{repo}/files/operations/{operation_id}` | `repo` | `read` |
| `POST` | `/api/v1/repos/{owner}/{repo}/files/write-token` | `repo` | `write` |
| `DELETE` | `/api/v1/repos/{owner}/{repo}/files/{path:path}` | `repo` | `write` |
| `PUT` | `/api/v1/repos/{owner}/{repo}/files/{path:path}` | `repo` | `write` |
| `GET` | `/api/v1/repos/{owner}/{repo}/ls` | `repo` | `read` |
| `GET` | `/api/v1/repos/{owner}/{repo}/members` | `repo` | `admin` |
| `DELETE` | `/api/v1/repos/{owner}/{repo}/members/{principal}` | `repo` | `admin` |
| `PUT` | `/api/v1/repos/{owner}/{repo}/members/{principal}` | `repo` | `admin` |
| `DELETE` | `/api/v1/repos/{repo_name}` | `repo` | `delete` |
| `GET` | `/api/v1/repos/{repo_name}` | `repo` | `read` |
| `GET` | `/api/v1/repos/{repo_name}/stats` | `repo` | `read` |
| `PATCH` | `/api/v1/repos/{repo_name}/visibility` | `repo` | `admin` |
| `GET` | `/api/v1/repos/{repo}/lineage` | `repo` | `read` |
| `POST` | `/api/v1/repos/{repo}/lineage` | `repo` | `write` |
| `DELETE` | `/api/v1/repos/{repo}/lineage/{lineage_id}` | `repo` | `write` |
| `GET` | `/api/v1/repos/{repo}/ls` | `repo` | `read` |
| `GET` | `/api/v1/repos/{repo}/permissions` | `repo` | `admin` |
| `PUT` | `/api/v1/repos/{repo}/permissions` | `repo` | `admin` |
| `DELETE` | `/api/v1/repos/{repo}/permissions/{email}` | `repo` | `admin` |

총 **42** 개 endpoint × scope.
