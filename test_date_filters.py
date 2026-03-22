"""Test that empty/None date filters don't exclude data."""
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

@pytest.mark.parametrize("endpoint", [
    "/reports/pnl",
    "/reports/vat",
    "/reports/withholding",
    "/reports/payments-by-project",
    "/reports/customer-transactions",
    "/reports/invoices",
])
def test_empty_date_strings_ignored(endpoint):
    """Empty date_from/date_to should behave like no filter."""
    r1 = client.get(endpoint, params={"project_id": 26})
    r2 = client.get(endpoint, params={"project_id": 26, "date_from": "", "date_to": ""})
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["rows"] == r2.json()["rows"]

@pytest.mark.parametrize("endpoint", [
    "/reports/pnl",
    "/reports/vat",
    "/reports/withholding",
    "/reports/payments-by-project",
])
def test_whitespace_date_strings_ignored(endpoint):
    """Whitespace-only date strings should behave like no filter."""
    r1 = client.get(endpoint, params={"project_id": 26})
    r2 = client.get(endpoint, params={"project_id": 26, "date_from": "  ", "date_to": "  "})
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["rows"] == r2.json()["rows"]
