"""Rule-based + Claude 메타데이터 생성.

sdk/enrichment.py에서 서버 사이드 enrichment 로직만 이관.
서버에서 Claude API 키를 관리하므로 SDK에 키 노출 불필요.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


_PROPERTY_FIELDS = (
    "project", "organization", "owner", "modality", "task",
    "data_count", "data_size", "license", "version", "tags",
    "updated_at", "data_card_tier",
)

_PROMPT = """\
아래는 데이터 저장소에 업로드된 데이터셋의 메타데이터입니다.

커밋 메시지: {message}
저장소 경로: {base_path}

파일 목록 (최대 30개):
{file_listing}

이 정보를 분석하여 다음 JSON을 반환하세요. JSON만 출력하고 다른 텍스트는 포함하지 마세요.
모든 필드는 문자열 값이어야 합니다.

{{
  "dataset_description": "이 데이터셋에 대한 1-3문장 한국어 설명.",
  "modality": "Text | Image | Video | Audio | Tabular | Code | Mixed",
  "task": "구체적 태스크 (예: QA, Summarization, Classification, 추론 불가 시 unknown)",
  "data_count": "데이터 항목 수 (추론 불가 시 unknown)",
  "data_size": "총 데이터 크기",
  "license": "라이선스 (추론 불가 시 unknown)",
  "version": "버전 (추론 불가 시 v1.0)",
  "tags": "쉼표로 구분된 키워드 태그",
  "data_card_tier": "Tier 2 (자동분석)"
}}
"""


class EnrichmentService:
    """메타데이터 자동 생성 서비스."""

    def enrich_metadata(
        self,
        file_listing: str,
        base_path: str,
        message: str = "",
    ) -> Optional[dict[str, str]]:
        """파일 목록 기반 Claude 메타데이터 생성.

        Args:
            file_listing: 파일 목록 문자열
            base_path: 저장소 경로
            message: 커밋 메시지

        Returns:
            메타데이터 dict 또는 실패 시 None
        """
        api_key = settings.llm_api_key
        if not api_key:
            logger.info("LLM API key 미설정, enrichment 스킵")
            return None

        try:
            import anthropic
        except ImportError:
            logger.warning("anthropic 패키지 미설치, enrichment 스킵")
            return None

        try:
            client = anthropic.Anthropic(api_key=api_key)
            resp = client.messages.create(
                model=settings.llm_model,
                max_tokens=1024,
                messages=[
                    {
                        "role": "user",
                        "content": _PROMPT.format(
                            message=message,
                            base_path=base_path,
                            file_listing=file_listing,
                        ),
                    }
                ],
            )
            text = resp.content[0].text.strip()

            # ```json ... ``` 블록 추출
            json_match = re.search(r"```json\s*\n(.*?)```", text, re.DOTALL)
            if json_match:
                text = json_match.group(1).strip()
            elif text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

            result = json.loads(text)
            if not isinstance(result, dict):
                return None

            # 문자열 필드만 추출
            metadata: dict[str, str] = {}
            if "dataset_description" in result:
                metadata["dataset_description"] = str(result["dataset_description"])
            for f in _PROPERTY_FIELDS:
                if f in result and result[f] is not None:
                    metadata[f] = str(result[f])

            return metadata

        except Exception:
            logger.warning("Claude 메타데이터 분석 실패", exc_info=True)
            return None
