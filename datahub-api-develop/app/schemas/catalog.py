"""Search/Table/Metadata 스키마."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class TableInfoResponse(BaseModel):
    full_name: str
    catalog_name: str
    schema_name: str
    table_name: str
    storage_location: str
    comment: Optional[str] = None
    table_type: Optional[str] = None
    data_source_format: Optional[str] = None
    properties: Optional[dict[str, str]] = None


class TableListResponse(BaseModel):
    tables: list[TableInfoResponse]


class CatalogListResponse(BaseModel):
    catalogs: list[str]


class MetadataUpdateRequest(BaseModel):
    dataset_description: Optional[str] = None
    project: Optional[str] = None
    organization: Optional[str] = None
    owner: Optional[str] = None
    modality: Optional[str] = None
    task: Optional[str] = None
    data_count: Optional[str] = None
    data_size: Optional[str] = None
    license: Optional[str] = None
    version: Optional[str] = None
    tags: Optional[str] = None
    updated_at: Optional[str] = None
    data_card_tier: Optional[str] = None


class EnrichRequest(BaseModel):
    file_listing: str
    base_path: str
    message: str = ""


class FilterOptionsResponse(BaseModel):
    modalities: list[str] = []
    tasks: list[str] = []
    organizations: list[str] = []
    data_card_tiers: list[str] = []


class EnrichResponse(BaseModel):
    metadata: Optional[dict[str, str]] = None
