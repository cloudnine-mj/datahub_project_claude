"""TableInfo / DatasetMetadata 타입 유닛 테스트."""

from __future__ import annotations

from datahub.types import DatasetMetadata, TableInfo


class TestTableInfo:
    def test_creation(self):
        table = TableInfo(
            full_name="nlp_lab.datasets.ner_v4",
            catalog_name="nlp_lab",
            schema_name="datasets",
            table_name="ner_v4",
            storage_location="gs://nlp-lab-bucket/ner/v4/",
            comment="NER 데이터셋 v4",
        )
        assert table.full_name == "nlp_lab.datasets.ner_v4"
        assert table.storage_location == "gs://nlp-lab-bucket/ner/v4/"

    def test_optional_fields_default_none(self):
        table = TableInfo(
            full_name="a.b.c",
            catalog_name="a",
            schema_name="b",
            table_name="c",
            storage_location="gs://bucket/path",
        )
        assert table.comment is None
        assert table.table_type is None
        assert table.properties is None


class TestDatasetMetadata:
    def test_to_dict_only_non_none(self):
        meta = DatasetMetadata(
            dataset_description="NER training set",
            language="ko",
        )
        d = meta.to_dict()
        assert d["dataset_description"] == "NER training set"
        assert d["language"] == "ko"
        assert "modality" not in d

    def test_to_dict_all_none_returns_empty(self):
        meta = DatasetMetadata()
        assert meta.to_dict() == {}

    def test_to_dict_all_fields(self):
        meta = DatasetMetadata(
            dataset_description="desc",
            modality="text",
            language="en",
            format="parquet",
            task="ner",
            domain="science",
            license="MIT",
            source="internal",
            version="1.0",
            owner="team@example.com",
        )
        d = meta.to_dict()
        assert len(d) == 10
