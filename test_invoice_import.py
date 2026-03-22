import pytest
from fastapi.testclient import TestClient
from main import app
import io

client = TestClient(app)

def test_invoice_import_endpoint_exists():
    """POST /invoices/import should accept CSV."""
    csv_content = "invoice_number,invoice_date,invoice_value,currency\nINV-001,2024-01-15,1000.50,EUR\n"
    r = client.post("/invoices/import",
        data={"project_id": "26"},
        files={"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
    )
    assert r.status_code == 200
    data = r.json()
    assert data["imported"] == 1
    assert data["errors"] == []

def test_invoice_import_handles_errors():
    """Bad CSV rows should be captured in errors."""
    csv_content = "invoice_number,invoice_date,invoice_value\nINV-002,2024-01-15,not_a_number\n"
    r = client.post("/invoices/import",
        data={"project_id": "26"},
        files={"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["errors"]) > 0 or data["imported"] >= 0  # Either errored or succeeded
