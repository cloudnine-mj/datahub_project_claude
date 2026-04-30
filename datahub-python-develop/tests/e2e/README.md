# E2E Tests

Real end-to-end tests against a live DataHub API server.

## Prerequisites

- `dh login` completed (valid credentials in `~/.datahub/credentials.json`)
- API server running at `DATAHUB_E2E_ENDPOINT` (default: `https://api.datahub.lgair-data.com`)
- Python dependencies installed: `pip install -e ".[dev,gcp]"`

## Run

```bash
# All E2E tests
pytest tests/e2e/ -v --timeout=120

# Specific category
pytest tests/e2e/test_repo.py -v
pytest tests/e2e/test_data.py -v
pytest tests/e2e/test_security.py -v

# With custom endpoint
DATAHUB_E2E_ENDPOINT=http://localhost:8080 pytest tests/e2e/ -v

# Run only E2E marked tests (from project root)
pytest -m e2e -v
```

## Notes

- Tests create repos with `e2e-{timestamp}-` prefix and clean up after themselves
- Tests require network access to the API server
- Do **NOT** run against production — tests create and delete resources
- The `unique_repo` fixture handles cleanup automatically via `repo delete`
- Token-based security tests use crafted invalid JWTs (no real credentials are leaked)

## Test Structure

| File                   | What it tests                                      |
| ---------------------- | -------------------------------------------------- |
| `test_auth.py`         | `whoami`, `--version`, `--help`                    |
| `test_repo.py`         | `repo create`, `repo list`, `repo delete`          |
| `test_data.py`         | `cp` upload/download, `ls`, `cat`                  |
| `test_versioning.py`   | `branch create/list/delete`, `merge`               |
| `test_search.py`       | `search`, `catalog list`                           |
| `test_permissions.py`  | `access grant`, `access revoke`                    |
| `test_security.py`     | Invalid tokens, URI validation, permission fences  |
