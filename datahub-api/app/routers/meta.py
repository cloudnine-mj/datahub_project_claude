"""Metadata vocabulary endpoints.

Read endpoints expose database-backed vocabulary values used by CLI/UI
dropdowns. Default rows are seeded during DB initialization, and administrators
can add or deactivate values without a code deploy.
"""

from __future__ import annotations

import re
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import MetadataVocabulary, User
from app.services.audit import audit
from app.services.metadata_vocabulary import list_vocabulary_items, normalize_vocabulary_kind

router = APIRouter()

_ITEM_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_.:+-]{0,127}$")
_ADMIN_ROLES = {"ADMIN", "SUPERADMIN"}


class MetaItem(BaseModel):
    id: str
    name: str
    description: str | None = None
    is_active: bool = True
    sort_order: int = 0


class MetaItemCreate(BaseModel):
    id: str = Field(..., min_length=1, max_length=128)
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    is_active: bool = True
    sort_order: int = 0


class MetaItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


def _require_metadata_admin(user: User = Depends(get_current_user)) -> User:
    if (user.role or "USER").upper() not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="metadata vocabulary admin role required")
    return user


def _validate_item_id(item_id: str) -> str:
    normalized = item_id.strip().lower()
    if not _ITEM_ID_RE.match(normalized):
        raise HTTPException(
            status_code=400,
            detail="metadata vocabulary id must match [a-z0-9][a-z0-9_.:+-]{0,127}",
        )
    return normalized


def _to_meta_item(row: MetadataVocabulary) -> MetaItem:
    return MetaItem(
        id=row.item_id,
        name=row.name,
        description=row.description,
        is_active=bool(row.is_active),
        sort_order=int(row.sort_order or 0),
    )


@router.get("/meta/{kind}", response_model=List[MetaItem])
def list_meta(kind: str, db: Session = Depends(get_db)):
    """List active metadata vocabulary values."""
    try:
        rows = list_vocabulary_items(db, kind)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return [_to_meta_item(row) for row in rows]


@router.get("/meta/{kind}/all", response_model=List[MetaItem])
def list_all_meta(
    kind: str,
    user: User = Depends(_require_metadata_admin),
    db: Session = Depends(get_db),
):
    """List active and inactive metadata vocabulary values for administrators."""
    try:
        rows = list_vocabulary_items(db, kind, include_inactive=True)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return [_to_meta_item(row) for row in rows]


@router.post("/meta/{kind}", response_model=MetaItem)
def create_meta_item(
    kind: str,
    body: MetaItemCreate,
    request: Request,
    user: User = Depends(_require_metadata_admin),
    db: Session = Depends(get_db),
):
    """Create a metadata vocabulary value."""
    try:
        normalized_kind = normalize_vocabulary_kind(kind)
        list_vocabulary_items(db, normalized_kind, include_inactive=True)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    item_id = _validate_item_id(body.id)
    if db.get(MetadataVocabulary, (normalized_kind, item_id)) is not None:
        raise HTTPException(status_code=409, detail=f"metadata vocabulary item already exists: {normalized_kind}/{item_id}")
    row = MetadataVocabulary(
        kind=normalized_kind,
        item_id=item_id,
        name=body.name.strip(),
        description=body.description,
        is_active=body.is_active,
        sort_order=body.sort_order,
        created_by=user.email,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="metadata_vocabulary_create",
        resource_type="metadata_vocabulary",
        resource_id=f"{normalized_kind}/{item_id}",
        details={"name": row.name, "is_active": row.is_active, "sort_order": row.sort_order},
        ip_address=request.client.host if request.client else None,
    )
    return _to_meta_item(row)


@router.patch("/meta/{kind}/{item_id}", response_model=MetaItem)
def update_meta_item(
    kind: str,
    item_id: str,
    body: MetaItemUpdate,
    request: Request,
    user: User = Depends(_require_metadata_admin),
    db: Session = Depends(get_db),
):
    """Update or reactivate a metadata vocabulary value."""
    try:
        normalized_kind = normalize_vocabulary_kind(kind)
        list_vocabulary_items(db, normalized_kind, include_inactive=True)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    normalized_id = _validate_item_id(item_id)
    row = db.get(MetadataVocabulary, (normalized_kind, normalized_id))
    if row is None:
        raise HTTPException(status_code=404, detail=f"metadata vocabulary item not found: {normalized_kind}/{normalized_id}")
    changes: dict[str, object] = {}
    if "name" in body.model_fields_set and body.name is not None:
        row.name = body.name.strip()
        changes["name"] = row.name
    if "description" in body.model_fields_set:
        row.description = body.description
        changes["description"] = row.description
    if "is_active" in body.model_fields_set and body.is_active is not None:
        row.is_active = body.is_active
        changes["is_active"] = row.is_active
    if "sort_order" in body.model_fields_set and body.sort_order is not None:
        row.sort_order = body.sort_order
        changes["sort_order"] = row.sort_order
    if not changes:
        raise HTTPException(status_code=400, detail="at least one field must be specified")
    db.commit()
    db.refresh(row)
    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="metadata_vocabulary_update",
        resource_type="metadata_vocabulary",
        resource_id=f"{normalized_kind}/{normalized_id}",
        details=changes,
        ip_address=request.client.host if request.client else None,
    )
    return _to_meta_item(row)


@router.delete("/meta/{kind}/{item_id}", response_model=MetaItem)
def deactivate_meta_item(
    kind: str,
    item_id: str,
    request: Request,
    user: User = Depends(_require_metadata_admin),
    db: Session = Depends(get_db),
):
    """Deactivate a metadata vocabulary value."""
    try:
        normalized_kind = normalize_vocabulary_kind(kind)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    normalized_id = _validate_item_id(item_id)
    row = db.get(MetadataVocabulary, (normalized_kind, normalized_id))
    if row is None:
        raise HTTPException(status_code=404, detail=f"metadata vocabulary item not found: {normalized_kind}/{normalized_id}")
    row.is_active = False
    db.commit()
    db.refresh(row)
    audit.log(
        db,
        user_id=user.id,
        user_email=user.email,
        action="metadata_vocabulary_deactivate",
        resource_type="metadata_vocabulary",
        resource_id=f"{normalized_kind}/{normalized_id}",
        ip_address=request.client.host if request.client else None,
    )
    return _to_meta_item(row)
