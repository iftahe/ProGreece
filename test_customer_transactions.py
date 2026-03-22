import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_customer_transactions_not_empty_when_balance_has_received():
    """Customer Transactions must return data when Customer Balance shows Received > 0."""
    balance = client.get("/reports/customer-balance", params={"project_id": 26}).json()
    has_received = any(row["received"] > 0 for row in balance["rows"])
    if not has_received:
        pytest.skip("No received amounts in customer balance")
    txns = client.get("/reports/customer-transactions", params={"project_id": 26}).json()
    assert len(txns["rows"]) > 0, "Customer Transactions empty but Customer Balance has received > 0"

def test_customer_transactions_total_matches_balance_received():
    """Total in Customer Transactions should match total received in Customer Balance."""
    balance = client.get("/reports/customer-balance", params={"project_id": 26}).json()
    txns = client.get("/reports/customer-transactions", params={"project_id": 26}).json()
    balance_received = balance["totals"]["received"]
    txns_total = txns["totals"]["amount"]
    assert abs(balance_received - txns_total) < 0.01

def test_customer_transactions_sorted_by_date():
    txns = client.get("/reports/customer-transactions", params={"project_id": 26}).json()
    dates = [r["date"] for r in txns["rows"] if r["date"]]
    assert dates == sorted(dates)
