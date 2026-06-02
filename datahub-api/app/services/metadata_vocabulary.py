"""Metadata vocabulary defaults and DB helpers."""

from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.models import MetadataVocabulary


VOCABULARY_KINDS = (
    "licenses",
    "tasks",
    "languages",
    "frameworks",
    "modalities",
    "formats",
    "domains",
    "sensitivities",
)


DEFAULT_METADATA_VOCABULARY: dict[str, tuple[tuple[str, str], ...]] = {
    "licenses": (
        ("apache-2.0", "Apache 2.0"),
        ("mit", "MIT"),
        ("cc-by-4.0", "CC BY 4.0"),
        ("cc-by-sa-4.0", "CC BY-SA 4.0"),
        ("cc-by-nc-4.0", "CC BY-NC 4.0"),
        ("cc-by-nc-sa-4.0", "CC BY-NC-SA 4.0"),
        ("cc0-1.0", "CC0 1.0"),
        ("gpl-3.0", "GPL-3.0"),
        ("lgpl-3.0", "LGPL-3.0"),
        ("bsd-3-clause", "BSD 3-Clause"),
        ("exaone-ai-model", "EXAONE AI Model License"),
        ("llama-3", "Llama 3 Community License"),
        ("other", "Other"),
    ),
    "tasks": (
        ("text-classification", "Text Classification"),
        ("token-classification", "Token Classification"),
        ("question-answering", "Question Answering"),
        ("summarization", "Summarization"),
        ("translation", "Translation"),
        ("text-generation", "Text Generation"),
        ("image-classification", "Image Classification"),
        ("object-detection", "Object Detection"),
        ("image-segmentation", "Image Segmentation"),
        ("image-text-to-text", "Image-Text-to-Text"),
        ("visual-question-answering", "Visual Question Answering"),
        ("document-question-answering", "Document Question Answering"),
        ("audio-classification", "Audio Classification"),
        ("automatic-speech-recognition", "Automatic Speech Recognition"),
        ("table-question-answering", "Table Question Answering"),
        ("feature-extraction", "Feature Extraction"),
        ("fill-mask", "Fill-Mask"),
        ("zero-shot-classification", "Zero-Shot Classification"),
        # Legacy compact task ids already accepted by repository metadata.
        ("ner", "Named Entity Recognition"),
        ("classification", "Classification"),
        ("generation", "Generation"),
        ("retrieval", "Retrieval"),
        ("other", "Other"),
    ),
    "languages": (
        ("ko", "Korean"),
        ("en", "English"),
        ("ja", "Japanese"),
        ("zh", "Chinese"),
        ("de", "German"),
        ("fr", "French"),
        ("es", "Spanish"),
        ("ar", "Arabic"),
        ("pt", "Portuguese"),
        ("ru", "Russian"),
        ("multi", "Multiple Languages"),
        ("multilingual", "Multilingual"),
        ("none", "None"),
        ("other", "Other"),
    ),
    "frameworks": (
        ("pytorch", "PyTorch"),
        ("tensorflow", "TensorFlow"),
        ("jax", "JAX"),
        ("transformers", "Transformers"),
        ("diffusers", "Diffusers"),
        ("safetensors", "Safetensors"),
        ("gguf", "GGUF"),
        ("onnx", "ONNX"),
        ("scikit-learn", "scikit-learn"),
        ("xgboost", "XGBoost"),
        ("lightgbm", "LightGBM"),
        ("other", "Other"),
    ),
    "modalities": (
        ("text", "Text"),
        ("image", "Image"),
        ("audio", "Audio"),
        ("video", "Video"),
        ("tabular", "Tabular"),
        ("multi", "Multiple Modalities"),
    ),
    "formats": (
        ("csv", "CSV"),
        ("json", "JSON"),
        ("jsonl", "JSONL"),
        ("parquet", "Parquet"),
        ("txt", "Text"),
        ("zip", "ZIP"),
        ("other", "Other"),
    ),
    "domains": (
        ("general", "General"),
        ("medical", "Medical"),
        ("finance", "Finance"),
        ("legal", "Legal"),
        ("nlp", "NLP"),
        ("vision", "Vision"),
        ("other", "Other"),
    ),
    "sensitivities": (
        ("public", "Public"),
        ("internal", "Internal"),
        ("confidential", "Confidential"),
        ("restricted", "Restricted"),
        ("other", "Other"),
    ),
}


VALIDATED_PROPERTY_KINDS = {
    "modality": "modalities",
    "language": "languages",
    "format": "formats",
    "task": "tasks",
    "domain": "domains",
}


def normalize_vocabulary_kind(kind: str) -> str:
    normalized = kind.strip().lower()
    if normalized not in VOCABULARY_KINDS:
        raise ValueError(f"metadata vocabulary kind must be one of: {', '.join(VOCABULARY_KINDS)}")
    return normalized


def seed_default_vocabularies(db: Session, *, created_by: str = "system:default-seed") -> None:
    """Insert missing default vocabulary rows.

    The Alembic migration seeds production databases. This helper keeps test
    databases and freshly created local SQLite schemas usable without requiring
    migration execution.
    """
    for kind, items in DEFAULT_METADATA_VOCABULARY.items():
        for order, (item_id, name) in enumerate(items):
            existing = db.get(MetadataVocabulary, (kind, item_id))
            if existing is not None:
                continue
            db.add(
                MetadataVocabulary(
                    kind=kind,
                    item_id=item_id,
                    name=name,
                    is_active=True,
                    sort_order=order,
                    created_by=created_by,
                )
            )
    db.commit()


def ensure_default_vocabularies(db: Session) -> None:
    if db.query(MetadataVocabulary).limit(1).first() is None:
        seed_default_vocabularies(db)


def list_vocabulary_items(
    db: Session,
    kind: str,
    *,
    include_inactive: bool = False,
) -> list[MetadataVocabulary]:
    normalized = normalize_vocabulary_kind(kind)
    ensure_default_vocabularies(db)
    query = db.query(MetadataVocabulary).filter(MetadataVocabulary.kind == normalized)
    if not include_inactive:
        query = query.filter(MetadataVocabulary.is_active == True)  # noqa: E712
    return query.order_by(MetadataVocabulary.sort_order, MetadataVocabulary.item_id).all()


def active_vocabulary_ids(db: Session, kind: str) -> set[str]:
    return {item.item_id for item in list_vocabulary_items(db, kind)}


def defaults_for_kind(kind: str) -> Iterable[tuple[str, str]]:
    return DEFAULT_METADATA_VOCABULARY[normalize_vocabulary_kind(kind)]
