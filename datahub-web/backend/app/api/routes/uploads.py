"""범용 이미지 업로드 — 게시글 작성 중 마크다운 본문에 삽입할 이미지용.

게시글 attachment 와 별도의 endpoint:
  - 글이 아직 저장되지 않은 상태에서도 업로드 가능 (작성 중 paste/drag).
  - 저장 위치: ``uploads/images/<token>_<원본 파일명>``.
  - 응답으로 ``/api/uploads/images/<filename>`` URL 을 돌려주며, 마크다운에는
    ``![alt](URL)`` 형태로 삽입됨.
  - 조회는 공개 (게시글이 공개라 동일 정책).
"""

from __future__ import annotations

import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.api.deps import get_current_user
from app.config import settings
from app.models import User

router = APIRouter(prefix="/uploads", tags=["uploads"])

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10MB
ALLOWED_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/svg+xml"}


@router.post("/images", status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """이미지 1개 업로드 — 인증 필요. URL 반환."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"지원하지 않는 이미지 형식입니다: {file.content_type}",
        )

    contents = await file.read()
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"이미지 크기는 {MAX_IMAGE_BYTES // (1024 * 1024)}MB 이하여야 합니다.",
        )

    target_dir = settings.upload_dir / "images"
    target_dir.mkdir(parents=True, exist_ok=True)
    safe_name = (file.filename or "image").replace("/", "_").replace("\\", "_")
    stored_name = f"{secrets.token_hex(8)}_{safe_name}"
    target_path = target_dir / stored_name
    target_path.write_bytes(contents)

    return {
        "url": f"/api/uploads/images/{stored_name}",
        "filename": safe_name,
        "size_bytes": len(contents),
    }


@router.get("/images/{filename}")
def get_image(filename: str):
    """업로드된 이미지 직접 서빙. 디렉터리 탈출 방지."""
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="invalid filename")
    path = settings.upload_dir / "images" / filename
    if not path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="image not found")
    return FileResponse(path)
