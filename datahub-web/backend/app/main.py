"""FastAPI 진입점.

  uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import forms, me, posts, uploads
from app.config import settings
from app.db.session import Base, SessionLocal, engine
from app.seed import run_seed

# 모델을 import 해서 Base.metadata 에 등록 (create_all 이 알게)
from app import models  # noqa: F401


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        run_seed(db)
    yield


app = FastAPI(
    title="DataHub Governance API",
    version="0.1.0",
    description="Governance 탭 백엔드 — 게시판 + 신청서",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(me.router)
app.include_router(posts.router)
app.include_router(forms.router)
app.include_router(uploads.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
