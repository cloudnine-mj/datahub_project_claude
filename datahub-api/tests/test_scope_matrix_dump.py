"""scope-matrix dump script 단위 테스트.

architecture/access-tokens.md §2.5 의 자동 추출 동작 검증.
"""

from __future__ import annotations

from app.scripts.dump_scope_matrix import collect_scope_matrix, render_markdown


class TestCollectScopeMatrix:
    def test_returns_non_empty_after_router_attach(self):
        """라우터 scope 추출 결과가 비어있지 않아야 한다."""
        rows = collect_scope_matrix()
        assert len(rows) > 0
        # 형식: (method, path, resource_type, min_action)
        for row in rows:
            assert len(row) == 4
            method, path, resource_type, min_action = row
            assert method in {"GET", "POST", "PUT", "DELETE", "PATCH"}
            assert path.startswith("/")
            assert resource_type in {"repo", "group", "user", "catalog"}
            assert min_action in {
                "read",
                "write",
                "admin",
                "delete",
                "discussion",
                "settings_read",
                "settings_write",
                "access_request_read",
            }

    def test_includes_known_critical_endpoints(self):
        """architecture §3.7 의 시나리오에 등장하는 endpoint 들이 포함되어야."""
        rows = collect_scope_matrix()
        triples = {(m, p, a) for m, p, _, a in rows}
        # 시나리오 2 — visibility 변경 = admin
        assert ("PATCH", "/api/v1/repos/{repo_name}/visibility", "admin") in triples
        # 시나리오 3 — DELETE repo = delete
        assert ("DELETE", "/api/v1/repos/{repo_name}", "delete") in triples
        assert ("DELETE", "/api/v1/repos/{group}/{repo_name}", "delete") in triples
        # 시나리오 1 — download = read
        assert ("POST", "/api/v1/repos/{owner}/{repo}/files/download-token", "read") in triples


class TestRenderMarkdown:
    def test_markdown_has_table_header_and_rows(self):
        rows = [
            ("GET", "/api/v1/repos/{repo}", "repo", "read"),
            ("DELETE", "/api/v1/repos/{repo}", "repo", "delete"),
        ]
        md = render_markdown(rows)
        assert "| Method | Path | Resource | Min Action |" in md
        assert "`GET`" in md and "`DELETE`" in md
        assert "총 **2** 개 endpoint × scope." in md

    def test_empty_rows(self):
        md = render_markdown([])
        assert "총 **0** 개 endpoint × scope." in md
