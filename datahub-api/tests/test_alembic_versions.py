from __future__ import annotations

import importlib.util
from pathlib import Path


def test_alembic_version_modules_import_without_runtime_side_effects():
    versions_dir = Path(__file__).resolve().parents[1] / "alembic" / "versions"
    for path in sorted(versions_dir.glob("*.py")):
        spec = importlib.util.spec_from_file_location(f"alembic_version_{path.stem}", path)
        assert spec is not None
        assert spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        assert isinstance(module.revision, str)
        assert callable(module.upgrade)
        assert callable(module.downgrade)
