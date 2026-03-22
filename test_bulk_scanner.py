"""
Tests for Bulk Transaction Scanner — To Account column and Income/Expense toggle.
"""
import pytest
from datetime import date
from fastapi.testclient import TestClient

import models


@pytest.fixture
def project_with_category(client, db):
    """Create a project and a budget category, return both."""
    proj_res = client.post("/projects/", json={
        "name": "Scanner Test Project",
        "status": "Active",
        "account_balance": 0,
    })
    assert proj_res.status_code == 200
    project = proj_res.json()

    cat = models.BudgetCategory(
        project_id=project["id"],
        category_name="Materials",
        planned_amount=50000,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return {"project": project, "category": cat}


@pytest.fixture
def unmapped_transaction(db, project_with_category):
    """Insert an unmapped transaction with known counterparty."""
    counterparty = models.Counterparty(name="ACME Supplies")
    db.add(counterparty)
    db.commit()
    db.refresh(counterparty)

    tx = models.Transaction(
        project_id=project_with_category["project"]["id"],
        date=date(2025, 1, 15),
        amount=1500,
        description="Vendor invoice XYZ-001",
        category="Unclassified",
        direction="out",
        type="expense",
        budget_item_id=None,
        counterparty_id=counterparty.id,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


@pytest.fixture
def unmapped_transaction_income(db, project_with_category):
    """Insert an unmapped income transaction with a to_account."""
    account = models.Account(name="Bank Main", is_system_account=0)
    db.add(account)
    db.commit()
    db.refresh(account)

    tx = models.Transaction(
        project_id=project_with_category["project"]["id"],
        date=date(2025, 2, 10),
        amount=5000,
        description="Customer payment",
        category="Revenue",
        direction="in",
        type="income",
        budget_item_id=None,
        to_account_id=account.id,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


class TestScannerReturnsToAccount:
    """Scanner endpoint returns to_account field in unmatched items."""

    def test_unmatched_has_to_account_from_counterparty(self, client, project_with_category, unmapped_transaction):
        project_id = project_with_category["project"]["id"]
        res = client.post(f"/admin/budget-mapper/{project_id}?dry_run=true")
        assert res.status_code == 200
        data = res.json()

        assert data["total_unmatched"] >= 1
        unmatched_item = next(
            (u for u in data["unmatched"] if u["transaction_id"] == unmapped_transaction.id),
            None
        )
        assert unmatched_item is not None, "Transaction not found in unmatched list"
        assert "to_account" in unmatched_item
        assert unmatched_item["to_account"] == "ACME Supplies"

    def test_unmatched_has_to_account_from_account(self, client, project_with_category, unmapped_transaction_income):
        project_id = project_with_category["project"]["id"]
        res = client.post(f"/admin/budget-mapper/{project_id}?dry_run=true")
        assert res.status_code == 200
        data = res.json()

        unmatched_item = next(
            (u for u in data["unmatched"] if u["transaction_id"] == unmapped_transaction_income.id),
            None
        )
        assert unmatched_item is not None
        assert unmatched_item["to_account"] == "Bank Main"

    def test_unmatched_to_account_empty_string_when_no_counterparty(self, client, db, project_with_category):
        """Transaction with no counterparty or to_account returns empty string."""
        tx = models.Transaction(
            project_id=project_with_category["project"]["id"],
            date=date(2025, 3, 1),
            amount=999,
            description="Mystery payment",
            budget_item_id=None,
        )
        db.add(tx)
        db.commit()

        project_id = project_with_category["project"]["id"]
        res = client.post(f"/admin/budget-mapper/{project_id}?dry_run=true")
        assert res.status_code == 200
        data = res.json()

        item = next((u for u in data["unmatched"] if u["transaction_id"] == tx.id), None)
        assert item is not None
        assert item["to_account"] == ""


class TestScannerReturnsDirection:
    """Scanner endpoint returns direction field in unmatched items."""

    def test_unmatched_has_direction_out(self, client, project_with_category, unmapped_transaction):
        project_id = project_with_category["project"]["id"]
        res = client.post(f"/admin/budget-mapper/{project_id}?dry_run=true")
        assert res.status_code == 200
        data = res.json()

        item = next((u for u in data["unmatched"] if u["transaction_id"] == unmapped_transaction.id), None)
        assert item is not None
        assert "direction" in item
        assert item["direction"] == "out"

    def test_unmatched_has_direction_in(self, client, project_with_category, unmapped_transaction_income):
        project_id = project_with_category["project"]["id"]
        res = client.post(f"/admin/budget-mapper/{project_id}?dry_run=true")
        assert res.status_code == 200
        data = res.json()

        item = next((u for u in data["unmatched"] if u["transaction_id"] == unmapped_transaction_income.id), None)
        assert item is not None
        assert item["direction"] == "in"

    def test_unmatched_direction_defaults_to_out_when_null(self, client, db, project_with_category):
        """Transaction with null direction gets defaulted to 'out'."""
        tx = models.Transaction(
            project_id=project_with_category["project"]["id"],
            date=date(2025, 4, 1),
            amount=250,
            description="Untagged payment",
            budget_item_id=None,
            direction=None,
        )
        db.add(tx)
        db.commit()

        project_id = project_with_category["project"]["id"]
        res = client.post(f"/admin/budget-mapper/{project_id}?dry_run=true")
        data = res.json()

        item = next((u for u in data["unmatched"] if u["transaction_id"] == tx.id), None)
        assert item is not None
        assert item["direction"] == "out"


class TestBulkAssignAcceptsDirection:
    """Bulk assign endpoint accepts and applies direction parameter."""

    def test_bulk_assign_without_direction(self, client, project_with_category, unmapped_transaction):
        category_id = project_with_category["category"].id
        res = client.put("/admin/bulk-assign-budget", json={
            "transaction_ids": [unmapped_transaction.id],
            "budget_category_id": category_id,
        })
        assert res.status_code == 200
        data = res.json()
        assert data["updated"] == 1
        assert data["budget_category_id"] == category_id

    def test_bulk_assign_with_direction_in(self, client, db, project_with_category, unmapped_transaction):
        category_id = project_with_category["category"].id
        res = client.put("/admin/bulk-assign-budget", json={
            "transaction_ids": [unmapped_transaction.id],
            "budget_category_id": category_id,
            "direction": "in",
        })
        assert res.status_code == 200
        assert res.json()["updated"] == 1

        # Verify DB was updated
        db.expire_all()
        tx = db.query(models.Transaction).filter(models.Transaction.id == unmapped_transaction.id).first()
        assert tx.direction == "in"
        assert tx.type == "income"
        assert tx.budget_item_id == category_id

    def test_bulk_assign_with_direction_out(self, client, db, project_with_category, unmapped_transaction_income):
        category_id = project_with_category["category"].id
        res = client.put("/admin/bulk-assign-budget", json={
            "transaction_ids": [unmapped_transaction_income.id],
            "budget_category_id": category_id,
            "direction": "out",
        })
        assert res.status_code == 200

        db.expire_all()
        tx = db.query(models.Transaction).filter(models.Transaction.id == unmapped_transaction_income.id).first()
        assert tx.direction == "out"
        assert tx.type == "expense"

    def test_bulk_assign_ignores_invalid_direction(self, client, db, project_with_category, unmapped_transaction):
        """Invalid direction value should be ignored (not applied)."""
        original_direction = unmapped_transaction.direction
        category_id = project_with_category["category"].id
        res = client.put("/admin/bulk-assign-budget", json={
            "transaction_ids": [unmapped_transaction.id],
            "budget_category_id": category_id,
            "direction": "invalid_value",
        })
        assert res.status_code == 200

        db.expire_all()
        tx = db.query(models.Transaction).filter(models.Transaction.id == unmapped_transaction.id).first()
        # Direction should be unchanged since 'invalid_value' is not 'in' or 'out'
        assert tx.direction == original_direction

    def test_bulk_assign_multiple_transactions(self, client, db, project_with_category,
                                               unmapped_transaction, unmapped_transaction_income):
        category_id = project_with_category["category"].id
        ids = [unmapped_transaction.id, unmapped_transaction_income.id]
        res = client.put("/admin/bulk-assign-budget", json={
            "transaction_ids": ids,
            "budget_category_id": category_id,
            "direction": "out",
        })
        assert res.status_code == 200
        assert res.json()["updated"] == 2

        db.expire_all()
        for tx_id in ids:
            tx = db.query(models.Transaction).filter(models.Transaction.id == tx_id).first()
            assert tx.direction == "out"
            assert tx.type == "expense"
            assert tx.budget_item_id == category_id
