"""Minimal MCP server.

The launch-target API does not expose repository file/versioning tools through
MCP. This module intentionally keeps only a small health tool so enabling MCP
does not pull in storage-engine-specific dependencies.
"""

from __future__ import annotations

from fastmcp import FastMCP

mcp = FastMCP("DataHub")


@mcp.tool
def datahub_mcp_health() -> dict[str, str]:
    return {"status": "ok"}
