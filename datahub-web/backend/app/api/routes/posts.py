"""게시판 게시글 — 화면 2,3,4 (목록), 7 (작성), 12 (권한 거부).

URL: /boards/{board_type}/posts
  GET     /boards/{board_type}/posts          → 목록
  POST    /boards/{board_type}/posts          → 작성  (권한 필요)
  GET     /boards/{board_type}/posts/{id}     → 상세
  PATCH   /boards/{board_type}/posts/{id}     → 수정 (작성자 or admin)
  DELETE  /boards/{board_type}/posts/{id}     → 삭제 (작성자 or admin)

  파일 첨부 (forms 와 동일 패턴):
  POST    /boards/{board_type}/posts/{id}/attachments
  GET     /boards/{board_type}/posts/{id}/attachments/{aid}
  DELETE  /boards/{board_type}/posts/{id}/attachments/{aid}
"""

from __future__ import annotations

import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Path as PathParam, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_board_write
from app.config import settings
from app.db.session import get_db
from app.models import Post, PostAttachment, User
from app.models.post import BOARD_TYPES
from app.schemas.post import PostAttachmentOut, PostCreate, PostDetail, PostListItem, PostUpdate

router = APIRouter(prefix="/boards/{board_type}/posts", tags=["posts"])

MAX_UPLOAD_BYTES = 50 * 1024 * 1024


def _validate_board(board_type: str) -> str:
    if board_type not in BOARD_TYPES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"unknown board: {board_type}")
    return board_type


@router.get("", response_model=list[PostListItem])
def list_posts(
    board_type: str = PathParam(...),
    mine: bool = Query(False, description="True 면 본인이 작성한 글만 (공개 + 임시저장) — '내 문서 목록' 용도"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Post]:
    """게시판 목록 — 임시저장(is_draft) / 비공개(visibility='admin') 글의 노출 규칙:
      - admin: 모든 글 노출
      - 작성자 본인: 자기 글은 무조건 노출 (draft / 비공개 포함)
      - 그 외: !is_draft AND visibility='public' 인 글만 노출
    """
    _validate_board(board_type)
    q = db.query(Post).filter(Post.board_type == board_type)
    if mine:
        # '내 게시글' 모드 — 본인 작성분 모두 (drafts + 비공개 포함)
        q = q.filter(Post.author_id == user.id)
    elif user.role != "admin":
        q = q.filter(
            ((Post.is_draft == False) & (Post.visibility == "public"))  # noqa: E712
            | (Post.author_id == user.id)
        )
    # 상단 고정(pinned) 글이 최상단, 그 다음 생성일 역순
    return q.order_by(Post.pinned.desc(), Post.created_at.desc()).all()


@router.post("", response_model=PostDetail, status_code=status.HTTP_201_CREATED)
def create_post(
    payload: PostCreate,
    board_type: str = PathParam(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _validate_board(board_type)
    # 권한 체크 — require_board_write 는 board_type 가 path 라 동적 생성 필요
    if not user.can_write_board(board_type):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="이 게시판에 글을 작성할 권한이 없습니다.")

    post = Post(
        board_type=board_type,
        title=payload.title,
        doc_no=payload.doc_no,
        doc_type=payload.doc_type,
        category=payload.category,
        content=payload.content,
        author_id=user.id,
        author_name=user.name,
        is_draft=payload.is_draft,
        visibility=payload.visibility if payload.visibility in ("public", "admin") else "public",
        summary=payload.summary,
        tags=payload.tags,
        severity=payload.severity,
        applies_to=payload.applies_to,
        tldr=payload.tldr,
        action_items=payload.action_items,
        examples=payload.examples,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.get("/{post_id}", response_model=PostDetail)
def get_post(
    post_id: int,
    board_type: str = PathParam(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Post:
    _validate_board(board_type)
    post = db.query(Post).filter(Post.id == post_id, Post.board_type == board_type).first()
    if not post:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="post not found")
    # 임시저장 또는 비공개 글은 작성자 / admin 만 조회 가능
    is_restricted = post.is_draft or post.visibility == "admin"
    if is_restricted and post.author_id != user.id and user.role != "admin":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="post not found")
    return post


@router.patch("/{post_id}", response_model=PostDetail)
def update_post(
    post_id: int,
    payload: PostUpdate,
    board_type: str = PathParam(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _validate_board(board_type)
    post = db.query(Post).filter(Post.id == post_id, Post.board_type == board_type).first()
    if not post:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="post not found")
    if post.author_id != user.id and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="수정 권한이 없습니다.")
    data = payload.model_dump(exclude_unset=True)
    # visibility 는 허용 enum 만 적용
    if "visibility" in data and data["visibility"] not in ("public", "admin", None):
        data.pop("visibility")
    for field, value in data.items():
        if field == "visibility" and value is None:
            continue  # 명시적 None 은 무시 (기본 public 유지)
        setattr(post, field, value)
    db.commit()
    db.refresh(post)
    return post


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: int,
    board_type: str = PathParam(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _validate_board(board_type)
    post = db.query(Post).filter(Post.id == post_id, Post.board_type == board_type).first()
    if not post:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="post not found")
    if post.author_id != user.id and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="삭제 권한이 없습니다.")
    db.delete(post)
    db.commit()


@router.patch("/{post_id}/pin", response_model=PostDetail)
def toggle_pin(
    post_id: int,
    board_type: str = PathParam(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """게시글 상단 고정 토글 — admin 만 가능."""
    if user.role != "admin":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="고정 권한이 없습니다 (관리자 전용).",
        )
    _validate_board(board_type)
    post = db.query(Post).filter(Post.id == post_id, Post.board_type == board_type).first()
    if not post:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="post not found")
    post.pinned = not post.pinned
    db.commit()
    db.refresh(post)
    return post


# ── 파일 첨부 ─────────────────────────────────────────────────────────────────


def _get_post_or_404(board_type: str, post_id: int, db: Session) -> Post:
    _validate_board(board_type)
    post = db.query(Post).filter(Post.id == post_id, Post.board_type == board_type).first()
    if not post:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="post not found")
    return post


@router.post(
    "/{post_id}/attachments",
    response_model=PostAttachmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_post_attachment(
    post_id: int,
    file: UploadFile = File(...),
    board_type: str = PathParam(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """게시글에 파일 1개 업로드 — 50MB 제한.

    저장 경로: `uploads/posts/{post_id}/{token}_{원본파일명}`
    권한: 글 작성자 본인 또는 admin (조회는 공개).
    """
    post = _get_post_or_404(board_type, post_id, db)
    if post.author_id != user.id and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="첨부 권한이 없습니다.")

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"파일 크기는 {MAX_UPLOAD_BYTES // (1024 * 1024)}MB 이하여야 합니다.",
        )

    target_dir = settings.upload_dir / "posts" / str(post.id)
    target_dir.mkdir(parents=True, exist_ok=True)
    safe_name = (file.filename or "unnamed").replace("/", "_").replace("\\", "_")
    stored_name = f"{secrets.token_hex(8)}_{safe_name}"
    target_path = target_dir / stored_name
    target_path.write_bytes(contents)

    att = PostAttachment(
        post_id=post.id,
        filename=safe_name,
        stored_path=str(target_path),
        size_bytes=len(contents),
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return att


@router.get("/{post_id}/attachments/{att_id}")
def download_post_attachment(
    post_id: int,
    att_id: int,
    board_type: str = PathParam(...),
    db: Session = Depends(get_db),
):
    """첨부 다운로드 — 게시글이 공개라 별도 권한 체크 없음."""
    _get_post_or_404(board_type, post_id, db)
    att = (
        db.query(PostAttachment)
        .filter(PostAttachment.id == att_id, PostAttachment.post_id == post_id)
        .first()
    )
    if not att:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="attachment not found")
    if not Path(att.stored_path).exists():
        raise HTTPException(status.HTTP_410_GONE, detail="파일이 디스크에서 사라졌습니다.")
    return FileResponse(att.stored_path, filename=att.filename)


@router.delete(
    "/{post_id}/attachments/{att_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_post_attachment(
    post_id: int,
    att_id: int,
    board_type: str = PathParam(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    post = _get_post_or_404(board_type, post_id, db)
    if post.author_id != user.id and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="삭제 권한이 없습니다.")
    att = (
        db.query(PostAttachment)
        .filter(PostAttachment.id == att_id, PostAttachment.post_id == post_id)
        .first()
    )
    if not att:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="attachment not found")
    try:
        Path(att.stored_path).unlink(missing_ok=True)
    except OSError:
        pass
    db.delete(att)
    db.commit()
