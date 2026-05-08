"""메타데이터 조회 엔드포인트.

저장소 생성 폼에서 사용하는 드롭다운 데이터 (정적 목록).

- GET /meta/licenses     → SPDX 표준 라이선스 목록
- GET /meta/tasks        → ML task 목록
- GET /meta/languages    → 프로그래밍/자연어 목록
- GET /meta/frameworks   → ML 프레임워크 목록
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class MetaItem(BaseModel):
    id: str
    name: str


# ── 정적 데이터 ────────────────────────────────────────────────────────────────

_LICENSES: List[MetaItem] = [
    MetaItem(id="apache-2.0", name="Apache 2.0"),
    MetaItem(id="mit", name="MIT"),
    MetaItem(id="cc-by-4.0", name="CC BY 4.0"),
    MetaItem(id="cc-by-sa-4.0", name="CC BY-SA 4.0"),
    MetaItem(id="cc-by-nc-4.0", name="CC BY-NC 4.0"),
    MetaItem(id="cc-by-nc-sa-4.0", name="CC BY-NC-SA 4.0"),
    MetaItem(id="cc0-1.0", name="CC0 1.0"),
    MetaItem(id="gpl-3.0", name="GPL-3.0"),
    MetaItem(id="lgpl-3.0", name="LGPL-3.0"),
    MetaItem(id="bsd-3-clause", name="BSD 3-Clause"),
    MetaItem(id="exaone-ai-model", name="EXAONE AI Model License"),
    MetaItem(id="llama-3", name="Llama 3 Community License"),
    MetaItem(id="other", name="Other"),
]

_TASKS: List[MetaItem] = [
    MetaItem(id="text-classification", name="Text Classification"),
    MetaItem(id="token-classification", name="Token Classification"),
    MetaItem(id="question-answering", name="Question Answering"),
    MetaItem(id="summarization", name="Summarization"),
    MetaItem(id="translation", name="Translation"),
    MetaItem(id="text-generation", name="Text Generation"),
    MetaItem(id="image-classification", name="Image Classification"),
    MetaItem(id="object-detection", name="Object Detection"),
    MetaItem(id="image-segmentation", name="Image Segmentation"),
    MetaItem(id="image-text-to-text", name="Image-Text-to-Text"),
    MetaItem(id="visual-question-answering", name="Visual Question Answering"),
    MetaItem(id="document-question-answering", name="Document Question Answering"),
    MetaItem(id="audio-classification", name="Audio Classification"),
    MetaItem(id="automatic-speech-recognition", name="Automatic Speech Recognition"),
    MetaItem(id="table-question-answering", name="Table Question Answering"),
    MetaItem(id="feature-extraction", name="Feature Extraction"),
    MetaItem(id="fill-mask", name="Fill-Mask"),
    MetaItem(id="zero-shot-classification", name="Zero-Shot Classification"),
    MetaItem(id="other", name="Other"),
]

_LANGUAGES: List[MetaItem] = [
    MetaItem(id="ko", name="Korean"),
    MetaItem(id="en", name="English"),
    MetaItem(id="ja", name="Japanese"),
    MetaItem(id="zh", name="Chinese"),
    MetaItem(id="de", name="German"),
    MetaItem(id="fr", name="French"),
    MetaItem(id="es", name="Spanish"),
    MetaItem(id="ar", name="Arabic"),
    MetaItem(id="pt", name="Portuguese"),
    MetaItem(id="ru", name="Russian"),
    MetaItem(id="multilingual", name="Multilingual"),
]

_FRAMEWORKS: List[MetaItem] = [
    MetaItem(id="pytorch", name="PyTorch"),
    MetaItem(id="tensorflow", name="TensorFlow"),
    MetaItem(id="jax", name="JAX"),
    MetaItem(id="transformers", name="Transformers"),
    MetaItem(id="diffusers", name="Diffusers"),
    MetaItem(id="safetensors", name="Safetensors"),
    MetaItem(id="gguf", name="GGUF"),
    MetaItem(id="onnx", name="ONNX"),
    MetaItem(id="scikit-learn", name="scikit-learn"),
    MetaItem(id="xgboost", name="XGBoost"),
    MetaItem(id="lightgbm", name="LightGBM"),
    MetaItem(id="other", name="Other"),
]


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

@router.get("/meta/licenses", response_model=List[MetaItem])
def list_licenses():
    """SPDX 표준 라이선스 목록."""
    return _LICENSES


@router.get("/meta/tasks", response_model=List[MetaItem])
def list_tasks():
    """ML task 목록."""
    return _TASKS


@router.get("/meta/languages", response_model=List[MetaItem])
def list_languages():
    """프로그래밍/자연어 목록."""
    return _LANGUAGES


@router.get("/meta/frameworks", response_model=List[MetaItem])
def list_frameworks():
    """ML 프레임워크 목록."""
    return _FRAMEWORKS
