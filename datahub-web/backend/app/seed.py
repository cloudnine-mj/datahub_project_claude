"""Seed data — 화면 캡처에 보이는 항목을 그대로 복원.

DB 가 비어있을 때만 한 번 삽입 (idempotent).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Form, Post, User


def _ensure_users(db: Session) -> dict[str, User]:
    users_def = [
        # admin — 모든 게시판 글쓰기 가능
        (settings.default_admin_email, settings.default_admin_name, "admin", "Data Platform"),
        # editor — 글쓰기 가능
        ("siu@example.com", "Siu (datahub-storage)", "editor", "Backend"),
        ("doyun@example.com", "Doyun (datahub-qa)", "editor", "QA"),
        # viewer — 화면 12 트리거용 (글쓰기 권한 없음)
        ("viewer@example.com", "Viewer Lee", "viewer", "Marketing"),
        # 신청서 시드용 (REQ-2024-* 들 제출자)
        ("jun.lee@company.com", "이준혁", "editor", "데이터전략팀"),
    ]
    out: dict[str, User] = {}
    for email, name, role, dept in users_def:
        u = db.query(User).filter(User.email == email).first()
        if not u:
            u = User(email=email, name=name, role=role, department=dept)
            db.add(u)
        out[email] = u
    db.flush()
    return out


def _ensure_posts(db: Session, users: dict[str, User]) -> None:
    if db.query(Post).count() > 0:
        return

    admin = users[settings.default_admin_email]

    # 화면 3 — 데이터 제작 프로세스 (2 건, 2025.01.15)
    db.add_all([
        Post(
            board_type="production_process",
            title="용역 제작 요청 방법",
            category="가이드",
            content="외주 업체를 통한 데이터 용역 제작을 요청하는 절차를 안내합니다.\n\n"
                    "1. 데이터 제작 / 활용 신청서에서 '데이터 용역 제작 신청서' 작성\n"
                    "2. 작성 완료 후 전자결재 상신\n"
                    "3. 승인 후 외주 업체 매칭 및 작업 착수",
            author_id=admin.id,
            author_name=admin.name,
            created_at=datetime(2025, 1, 15, 10, 0),
        ),
        Post(
            board_type="production_process",
            title="구매/구독 요청 방법",
            category="가이드",
            content="외부 데이터셋 구매 또는 구독 신청 절차입니다.\n\n"
                    "- 일회성 구매 → 데이터 구매 신청서\n"
                    "- 정기 구독 → 데이터 구독 신청서",
            author_id=admin.id,
            author_name=admin.name,
            created_at=datetime(2025, 1, 15, 10, 5),
        ),
    ])

    # 화면 2 — 데이터 관리 정책: 빈 상태로 두어 empty state UX (작성 요청 CTA) 검증.
    # 정책은 거버넌스 관리자가 직접 작성하는 컨텐츠라 시드 자체를 비움.

    # 화면 4 — 데이터 활용 요청 프로세스 (2 건, 2025.01.15)
    db.add_all([
        Post(
            board_type="usage_process",
            title="Product 서비스 로그 데이터 활용 방법",
            category="가이드",
            content="Product 로그 데이터(클릭/세션/이벤트)는 별도 활용 신청서를 통해서만 접근 가능합니다.\n\n"
                    "신청서: 'Product 로그 데이터 활용 신청서'",
            author_id=admin.id,
            author_name=admin.name,
            created_at=datetime(2025, 1, 15, 9, 30),
        ),
        Post(
            board_type="usage_process",
            title="다운로드 불가능한 구매 데이터 활용 방법",
            category="가이드",
            content="라이선스 제약으로 다운로드가 불가능한 구매 데이터는 보안 워크스페이스에서만 사용 가능합니다.",
            author_id=admin.id,
            author_name=admin.name,
            created_at=datetime(2025, 1, 15, 9, 45),
        ),
    ])
    # 화면 2 — 데이터 관리 정책 은 빈 상태 그대로 둠


def _ensure_forms(db: Session, users: dict[str, User]) -> None:
    if db.query(Form).count() > 0:
        return

    jun = users["jun.lee@company.com"]

    # 화면 5/8 의 '내 문서 목록' 3건 + 화면 9 의 상세
    db.add_all([
        Form(
            request_no="REQ-2024-04291",
            form_type="data_purchase",
            project_name="2024 고객 행동 분석 플랫폼 구축",
            submitter_id=jun.id,
            submitter_name=jun.name,
            submitter_email=jun.email,
            submitter_department=jun.department,
            status="reviewing",
            approval_history=[
                {"status": "submitted", "changed_by": jun.name,
                 "changed_at": "2024-04-29T09:00:00", "comment": "최초 제출"},
                {"status": "reviewing", "changed_by": "Karlo Lee",
                 "changed_at": "2024-04-30T10:30:00", "comment": "검토 시작"},
            ],
            payload={
                "구매_희망_데이터셋": "국내 소비자 구매 패턴 데이터셋 v3",
                "판매_업체": "데이터코리아 주식회사",
                "사용_예상_금액": "8,500,000원",
                "사용_목적_및_기대_효과": "고객 세그먼트별 구매 패턴 분석을 통해 개인화 추천 모델 고도화 및 전환율 15% 향상 목표",
                "데이터_품질_검수_담당자": "김민지",
                "compliance_확인_여부": "확인 완료",
                "데이터셋_저장_레포지토리": "analytics-platform-repo",
            },
            submitted_at=datetime(2024, 4, 29, 9, 0),
        ),
        Form(
            request_no="REQ-2024-03187",
            form_type="data_production",
            project_name="마케팅 타겟 분석 프로젝트",
            submitter_id=jun.id,
            submitter_name=jun.name,
            submitter_email=jun.email,
            submitter_department=jun.department,
            status="approved",
            approval_history=[
                {"status": "submitted", "changed_by": jun.name,
                 "changed_at": "2024-03-18T09:00:00", "comment": "최초 제출"},
                {"status": "reviewing", "changed_by": "Karlo Lee",
                 "changed_at": "2024-03-20T11:00:00", "comment": None},
                {"status": "approved", "changed_by": "Karlo Lee",
                 "changed_at": "2024-03-25T15:30:00", "comment": "예산·일정 모두 적정 — 승인"},
            ],
            payload={
                "관련_프로젝트_PMS": "PMS-2024-MKT-019",
                "데이터셋_활용_목적": "타겟 세그먼트 분석 모델 학습",
                "데이터셋_이름": "marketing-target-segments-v1",
                "희망_작업_착수일": "2024-04-01",
                "희망_수령일": "2024-05-31",
                "접근_권한": "전사에 공유",
                "작업_형태": "라벨링",
                "작업_도구": "엑셀",
                "목표_데이터_수량": "10000",
                "단위": "문장",
            },
            submitted_at=datetime(2024, 3, 18, 9, 0),
        ),
        Form(
            request_no="REQ-2024-02043",
            form_type="data_purchase",
            project_name="물류 최적화 예측 모델",
            submitter_id=jun.id,
            submitter_name=jun.name,
            submitter_email=jun.email,
            submitter_department=jun.department,
            status="rejected",
            approval_history=[
                {"status": "submitted", "changed_by": jun.name,
                 "changed_at": "2024-02-05T09:00:00", "comment": "최초 제출"},
                {"status": "reviewing", "changed_by": "Karlo Lee",
                 "changed_at": "2024-02-07T14:00:00", "comment": None},
                {"status": "rejected", "changed_by": "Karlo Lee",
                 "changed_at": "2024-02-12T10:00:00",
                 "comment": "예산 초과 — 한 분기 분할 후 재신청 요청"},
            ],
            payload={
                "구매_희망_데이터셋": "국내 화물 운송 통계 2020-2024",
                "판매_업체": "한국교통연구원",
                "사용_예상_금액": "3,200,000원",
                "사용_목적_및_기대_효과": "물류 거점 최적화 및 배송 ETA 정확도 개선",
            },
            submitted_at=datetime(2024, 2, 5, 9, 0),
        ),
    ])


def run_seed(db: Session) -> None:
    users = _ensure_users(db)
    _ensure_posts(db, users)
    _ensure_forms(db, users)
    db.commit()
