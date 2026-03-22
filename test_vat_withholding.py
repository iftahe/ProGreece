import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_vat_report_empty_has_message():
    r = client.get("/reports/vat", params={"project_id": 26})
    assert r.status_code == 200
    data = r.json()
    if len(data["rows"]) == 0:
        assert "message" in data

def test_withholding_report_empty_has_message():
    r = client.get("/reports/withholding", params={"project_id": 26})
    assert r.status_code == 200
    data = r.json()
    if len(data["rows"]) == 0:
        assert "message" in data

def test_backfill_vat_endpoint_exists():
    # Don't actually backfill — just test the endpoint is reachable
    # Use a non-existent project to avoid modifying data
    r = client.post("/admin/backfill-vat", params={"project_id": 99999, "vat_rate": 0.24})
    assert r.status_code == 200
    assert r.json()["updated"] == 0

def test_backfill_withholding_endpoint_exists():
    r = client.post("/admin/backfill-withholding", params={"project_id": 99999, "withholding_rate": 0.03})
    assert r.status_code == 200
    assert r.json()["updated"] == 0
