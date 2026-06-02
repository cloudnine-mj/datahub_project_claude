from fastapi.testclient import TestClient

from app.main import app


def test_openapi_schema_is_exposed_under_api_v1_prefix():
    client = TestClient(app)

    response = client.get("/api/v1/openapi.json")

    assert response.status_code == 200
    assert response.json()["info"]["title"] == "Data Platform Service"


def test_legacy_root_openapi_schema_is_not_exposed():
    client = TestClient(app)

    response = client.get("/openapi.json")

    assert response.status_code == 404
