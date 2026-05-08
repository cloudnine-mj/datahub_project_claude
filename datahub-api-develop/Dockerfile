FROM python:3.12-slim

WORKDIR /srv

# 시스템 의존성
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 소스 복사 + 설치
COPY pyproject.toml .
COPY app/ app/
COPY mcp_app/ mcp_app/
COPY alembic.ini .
COPY alembic/ alembic/
RUN pip install --no-cache-dir .

# Alembic 마이그레이션 실행 후 서버 시작
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8080"]
