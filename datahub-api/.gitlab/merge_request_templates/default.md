## Summary

-

## Local API Runtime Verification

Use the local integration environment unless the change is documentation-only.

- Environment:
  - [ ] `scripts/dev-api up && scripts/dev-api migrate && scripts/dev-api server`
  - [ ] `scripts/dev-api api-up`
  - [ ] Other:
- Ports used:
  - API:
  - PostgreSQL:
  - Redis:
- Smoke test:
  - [ ] `scripts/dev-api smoke`
- Additional tests:
  - [ ] `uv run --frozen --extra dev python -m pytest ...`
  - [ ] `uv run --frozen --extra dev ruff check ...`
- If not run, explain why:

## Runtime Dependency Notes

- [ ] This MR does not introduce LakeFS/Unity Catalog/versioning as a launch-target core dependency.
- [ ] New external dependencies are documented in `docs/runtime-dependency-matrix.md` or intentionally out of scope.

## Develop Deploy Notes

- [ ] Helm render/deploy does not require LakeFS/Unity Catalog variables.
- [ ] Hosted pod health was checked after rollout, or the reason is documented.
