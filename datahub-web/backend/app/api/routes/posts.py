"""게시판 게시글 — 화면 2,3,4 (목록), 7 (작성), 12 (권한 거부).

URL: /boards/{board_type}/posts
  GET     /boards/{board_type}/posts          → 목록
  POST    /boards/{board_type}/posts          → 작성  (권한 필요)
  GET     /boards/{board_type}/posts/{id}     → 상세
  PATCH   /boards/{board_type}/posts/{id}     → 수정 (작성자 or admin)
  DELETE  /boards/{board_type}/posts/{id}     → 삭제 (작성자 or admin)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_board_write
from app.db.session import get_db
from app.models import Post, User
from app.models.post import BOARD_TYPES
from app.schemas.post import PostCreate, PostDetail, PostListItem, PostUpdate

router = APIRouter(prefix="/boards/{board_type}/posts", tags=["posts"])


def _validate_board(board_type: str) -> str:
    if board_type not in BOARD_TYPES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"unknown board: {board_type}")
    return board_type


@router.get("", response_model=list[PostListItem])
def list_posts(
    board_type: str = Path(...),
    db: Session = Depends(get_db),
) -> list[Post]:
    _validate_board(board_type)
    return (
        db.query(Post)
        .filter(Post.board_type == board_type)
        .order_by(Post.created_at.desc())
        .all()
    )


@router.post("", response_model=PostDetail, status_code=status.HTTP_201_CREATED)
def create_post(
    payload: PostCreate,
    board_type: str = Path(...),
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
        category=payload.category,
        content=payload.content,
        author_id=user.id,
        author_name=user.name,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.get("/{post_id}", response_model=PostDetail)
def get_post(post_id: int, board_type: str = Path(...), db: Session = Depends(get_db)) -> Post:
    _validate_board(board_type)
    post = db.query(Post).filter(Post.id == post_id, Post.board_type == board_type).first()
    if not post:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="post not found")
    return post


@router.patch("/{post_id}", response_model=PostDetail)
def update_post(
    post_id: int,
    payload: PostUpdate,
    board_type: str = Path(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _validate_board(board_type)
    post = db.query(Post).filter(Post.id == post_id, Post.board_type == board_type).first()
    if not post:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="post not found")
    if post.author_id != user.id and user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="수정 권한이 없습니다.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(post, field, value)
    db.commit()
    db.refresh(post)
    return post


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: int,
    board_type: str = Path(...),
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
