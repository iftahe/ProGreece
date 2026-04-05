"""End-to-end test: map a transaction via scanner, verify it appears in all reports."""
import pytest
from datetime import datetime
from models import Project, BudgetCategory, Transaction, Account


@pytest.fixture
def e2e_data(db):
    """Set up a project with a budget category and an unmapped transaction."""
    project = Project(name="E2E Test", status="Active")
    db.add(project)
    db.flush()

    cat = BudgetCategory(
        project_id=project.id, category_name="Construction",
        planned_amount=500000, category_type="expense"
    )
    db.add(cat)
    db.flush()

    from_acc = Account(name="Bank Alpha", account_type_id=None)
    to_acc = Account(name="Contractor Ltd", account_type_id=None)
    db.add_all([from_acc, to_acc])
    db.flush()

    tx = Transaction(
        project_id=project.id, date=datetime(2024, 6, 15),
        amount=50000, direction='out', status=None,
        budget_item_id=None, category='construction work',
        description='Phase 1 foundation', from_account_id=from_acc.id,
        to_account_id=to_acc.id, vat_rate=0.24, vat_amount=0,
        withholding_rate=0.03, withholding_amount=0, type='expense'
    )
    db.add(tx)
    db.commit()

    return {"project": project, "category": cat, "transaction": tx}


def test_e2e_scanner_shows_from_account(client, e2e_data):
    """Scanner response must include from_account field."""
    project = e2e_data["project"]
    resp = client.post(f"/admin/budget-mapper/{project.id}?dry_run=true")
    assert resp.status_code == 200
    data = resp.json()
    all_items = data["mappings"] + data["unmatched"]
    assert len(all_items) >= 1
    item = all_items[0]
    assert "from_account" in item
    assert "to_account" in item


def test_e2e_map_then_verify_pnl(client, db, e2e_data):
    """After bulk-assign, transaction must appear in P&L report with correct VAT."""
    project = e2e_data["project"]
    cat = e2e_data["category"]
    tx = e2e_data["transaction"]

    resp = client.put("/admin/bulk-assign-budget", json={
        "transaction_ids": [tx.id],
        "budget_category_id": cat.id,
        "direction": "out"
    })
    assert resp.status_code == 200

    resp = client.get(f"/reports/pnl?project_id={project.id}")
    assert resp.status_code == 200
    data = resp.json()
    detail_rows = [r for r in data["rows"] if r["row_type"] == "detail"]
    assert len(detail_rows) >= 1
    assert any(r["trans_value"] == 50000.0 for r in detail_rows)
    vat_row = [r for r in detail_rows if r["trans_value"] == 50000.0][0]
    assert vat_row["vat_value"] == 12000.0  # 50000 * 0.24
    assert vat_row["withholding_value"] == 1500.0  # 50000 * 0.03


def test_e2e_map_then_verify_vat_report(client, db, e2e_data):
    """After bulk-assign with VAT backfill, transaction must appear in VAT report."""
    project = e2e_data["project"]
    cat = e2e_data["category"]
    tx = e2e_data["transaction"]

    client.put("/admin/bulk-assign-budget", json={
        "transaction_ids": [tx.id],
        "budget_category_id": cat.id,
        "direction": "out"
    })

    resp = client.get(f"/reports/vat?project_id={project.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["rows"]) >= 1
    assert any(r["vat_amount"] == 12000.0 for r in data["rows"])


def test_e2e_map_then_verify_plan_vs_actual(client, db, e2e_data):
    """After mapping, transaction must appear in Budget vs Actual."""
    project = e2e_data["project"]
    cat = e2e_data["category"]
    tx = e2e_data["transaction"]

    client.put("/admin/bulk-assign-budget", json={
        "transaction_ids": [tx.id],
        "budget_category_id": cat.id,
        "direction": "out"
    })

    resp = client.get(f"/reports/plan-vs-actual?project_id={project.id}")
    assert resp.status_code == 200
    data = resp.json()
    construction_row = [r for r in data["rows"] if r["category"] == "Construction"]
    assert len(construction_row) == 1
    assert construction_row[0]["actual"] == 50000.0
    assert construction_row[0]["vat_amount"] == 12000.0


def test_e2e_status_set_correctly(client, db, e2e_data):
    """After bulk-assign, status must be 'executed'."""
    tx = e2e_data["transaction"]
    cat = e2e_data["category"]

    client.put("/admin/bulk-assign-budget", json={
        "transaction_ids": [tx.id],
        "budget_category_id": cat.id,
        "direction": "out"
    })

    # Expire cached state so we see the DB changes made by the API
    db.expire_all()
    db.refresh(tx)
    assert tx.status == "executed"
    assert tx.direction == "out"
    assert tx.type == "expense"
    assert tx.budget_item_id == cat.id
