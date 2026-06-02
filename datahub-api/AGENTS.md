# DataHub API Agent Instructions

## Development Direction

The launch-target API runtime is repository-first and control-plane focused. Do not reintroduce storage-engine PoC dependencies, Unity Catalog, branch/commit/merge/versioning, or `X-API-Key` as new core contracts unless the relevant governance contract is updated first.

Runtime dependency boundaries are documented in `docs/runtime-dependency-matrix.md`.

## Local API Runtime

API behavior changes must be verified against a hosted local FastAPI server and PostgreSQL, not only unit tests.

Default local loop:

```bash
scripts/dev-api up
scripts/dev-api migrate
scripts/dev-api server
scripts/dev-api smoke
```

Docker-hosted API loop:

```bash
scripts/dev-api api-up
scripts/dev-api smoke
```

## Port Conflicts

Default ports:

- API: `18080`
- PostgreSQL: `15432`
- Redis: `16379`

If another local service already uses a port, do not hardcode a new value in source files. Use environment overrides:

```bash
DATAHUB_DEV_API_PORT=18081 scripts/dev-api server
DATAHUB_DEV_POSTGRES_PORT=15433 DATAHUB_DEV_REDIS_PORT=16380 scripts/dev-api up
DATAHUB_DEV_COMPOSE_PROJECT=datahub-api-dev-<name> scripts/dev-api api-up
```

Check current port availability with:

```bash
scripts/dev-api check-ports
scripts/dev-api env
```

## Merge Request Ground Rule

Every API behavior MR must report:

- Which local runtime was used: local `uvicorn` or Compose `api`
- API/PostgreSQL/Redis ports used
- `scripts/dev-api smoke` result
- Additional pytest/ruff/manual HTTP checks
- If the local runtime was not used, the reason

Use `.gitlab/merge_request_templates/default.md`.

## Develop K8s Deployment Boundary

The `develop` deployment path must match the launch-target runtime boundary:

- Core: FastAPI platform service, Redis, shared PostgreSQL `platform_db`
- Disabled by default: Unity Catalog, MCP endpoints
- CI must not require storage-engine PoC or Unity Catalog passwords/access keys for API deploy
- After rollout, verify the hosted pod health endpoint and confirm `MCP_ENABLED=false`

Do not add Helm or CI deploy dependencies unless they are also reflected in `docs/runtime-dependency-matrix.md`.
