"""Lineage 스키마."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class CreateLineageRequest(BaseModel):
    source_repo: str
    relation_type: str = "derived_from"
    description: Optional[str] = None


class LineageEntry(BaseModel):
    id: int
    lineage_id: str
    source_repo: str
    derived_repo: str
    relation_type: str
    description: Optional[str] = None
    created_by: str  # email
    created_at: datetime


class LineageListResponse(BaseModel):
    upstream: list[LineageEntry] = []
    downstream: list[LineageEntry] = []


class LineageGraphNode(BaseModel):
    repo_name: str
    owner: str
    visibility: str


class LineageGraphEdge(BaseModel):
    source: str
    target: str
    relation_type: str


class LineageGraphResponse(BaseModel):
    nodes: list[LineageGraphNode]
    edges: list[LineageGraphEdge]
