import pytest
from fastapi.testclient import TestClient
from main import app
import models

# conftest.py provides: client fixture, db fixture, reset_db autouse fixture


def seed_pnl_data(db):
    """Seed a project with income and expense transactions for P&L testing."""
    proj = models.Project(name="PnL Test Project", status="Active", account_balance=0)
    db.add(proj)
    db.commit()
    db.refresh(proj)

    transactions = [
        # Income transactions (direction='in')
        models.Transaction(
            project_id=proj.id, direction="in", status="executed",
            category="Buying", amount=100000, vat_amount=0, withholding_amount=0,
            supplier="Customer A", description="Apartment sale"
        ),
        models.Transaction(
            project_id=proj.id, direction="in", status="executed",
            category="General", amount=5000, vat_amount=0, withholding_amount=0,
            supplier="Customer B", description="Advance payment"
        ),
        # Expense transactions (direction='out')
        models.Transaction(
            project_id=proj.id, direction="out", status="executed",
            category="Construction", amount=40000, vat_amount=0, withholding_amount=0,
            supplier="Contractor X", description="Construction work"
        ),
        models.Transaction(
            project_id=proj.id, direction="out", status="executed",
            category="Construction", amount=20000, vat_amount=0, withholding_amount=0,
            supplier="Contractor Y", description="Additional work"
        ),
        models.Transaction(
            project_id=proj.id, direction="out", status="executed",
            category="Buying", amount=10000, vat_amount=0, withholding_amount=0,
            supplier="Registry", description="Tax"
        ),
    ]
    for tx in transactions:
        db.add(tx)
    db.commit()
    return proj.id


def test_pnl_has_row_types(client, db):
    proj_id = seed_pnl_data(db)
    r = client.get("/reports/pnl", params={"project_id": proj_id})
    assert r.status_code == 200
    data = r.json()
    row_types = {row["row_type"] for row in data["rows"]}
    assert "section_header" in row_types
    assert "detail" in row_types or "subtotal" in row_types
    assert "grand_total" in row_types


def test_pnl_has_income_and_expense_totals(client, db):
    proj_id = seed_pnl_data(db)
    r = client.get("/reports/pnl", params={"project_id": proj_id})
    data = r.json()
    totals = data["totals"]
    assert "income_total" in totals
    assert "expense_total" in totals
    assert "net_profit" in totals


def test_pnl_net_profit_equals_income_minus_expense(client, db):
    proj_id = seed_pnl_data(db)
    r = client.get("/reports/pnl", params={"project_id": proj_id})
    data = r.json()
    t = data["totals"]
    assert abs(t["net_profit"] - (t["income_total"] - t["expense_total"])) < 0.01


def test_pnl_minimizes_unknown(client, db):
    proj_id = seed_pnl_data(db)
    r = client.get("/reports/pnl", params={"project_id": proj_id})
    data = r.json()
    details = [row for row in data["rows"] if row["row_type"] == "detail"]
    unknown = [row for row in details if row["category"] == "Unknown"]
    if details:
        assert len(unknown) / len(details) < 0.5


def test_pnl_sections_are_income_then_expense(client, db):
    proj_id = seed_pnl_data(db)
    r = client.get("/reports/pnl", params={"project_id": proj_id})
    data = r.json()
    headers = [row for row in data["rows"] if row["row_type"] == "section_header"]
    assert len(headers) == 2
    assert headers[0]["section"] == "income"
    assert headers[1]["section"] == "expense"
