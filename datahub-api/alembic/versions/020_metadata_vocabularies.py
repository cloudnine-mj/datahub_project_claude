"""Add database-backed metadata vocabularies.

Revision ID: 020
Revises: 019
Create Date: 2026-05-14 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DEFAULTS: dict[str, tuple[tuple[str, str], ...]] = {
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


def _seed_rows() -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for kind, items in DEFAULTS.items():
        for sort_order, (item_id, name) in enumerate(items):
            rows.append(
                {
                    "kind": kind,
                    "item_id": item_id,
                    "name": name,
                    "is_active": True,
                    "sort_order": sort_order,
                    "created_by": "migration:020",
                }
            )
    return rows


def upgrade() -> None:
    op.create_table(
        "metadata_vocabularies",
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("item_id", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_by", sa.String(length=320), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("kind", "item_id"),
    )
    op.create_index(
        "ix_metadata_vocabularies_kind_active_order",
        "metadata_vocabularies",
        ["kind", "is_active", "sort_order"],
    )
    table = sa.table(
        "metadata_vocabularies",
        sa.column("kind", sa.String),
        sa.column("item_id", sa.String),
        sa.column("name", sa.String),
        sa.column("is_active", sa.Boolean),
        sa.column("sort_order", sa.Integer),
        sa.column("created_by", sa.String),
    )
    op.bulk_insert(table, _seed_rows())


def downgrade() -> None:
    op.drop_index("ix_metadata_vocabularies_kind_active_order", table_name="metadata_vocabularies")
    op.drop_table("metadata_vocabularies")
