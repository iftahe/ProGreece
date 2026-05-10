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
        description="Wire received",
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


class TestScannerReturnsFromAccount:
    """Scanner endpoint returns from_account field in unmatched items."""

    def test_unmatched_has_from_account(self, client, db, project_with_category):
        """Transaction with from_account_id returns account name."""
        account = models.Account(name="Alpha Bank", is_system_account=0)
        db.add(account)
        db.commit()
        db.refresh(account)

        tx = models.Transaction(
            project_id=project_with_category["project"]["id"],
            date=date(2025, 5, 1),
            amount=3000,
            description="Wire transfer",
            budget_item_id=None,
            from_account_id=account.id,
            direction="out",
            type="expense",
        )
        db.add(tx)
        db.commit()
        db.refresh(tx)

        project_id = project_with_category["project"]["id"]
        res = client.post(f"/admin/budget-mapper/{project_id}?dry_run=true")
        assert res.status_code == 200
        data = res.json()

        item = next((u for u in data["unmatched"] if u["transaction_id"] == tx.id), None)
        assert item is not None
        assert "from_account" in item
        assert item["from_account"] == "Alpha Bank"

    def test_unmatched_from_account_empty_when_missing(self, client, project_with_category, unmapped_transaction):
        """Transaction without from_account_id returns empty string."""
        project_id = project_with_category["project"]["id"]
        res = client.post(f"/admin/budget-mapper/{project_id}?dry_run=true")
        assert res.status_code == 200
        data = res.json()

        item = next((u for u in data["unmatched"] if u["transaction_id"] == unmapped_transaction.id), None)
        assert item is not None
        assert item["from_account"] == ""

    def test_unmatched_has_type_field(self, client, project_with_category, unmapped_transaction):
        """Transaction returns type field."""
        project_id = project_with_category["project"]["id"]
        res = client.post(f"/admin/budget-mapper/{project_id}?dry_run=true")
        assert res.status_code == 200
        data = res.json()

        item = next((u for u in data["unmatched"] if u["transaction_id"] == unmapped_transaction.id), None)
        assert item is not None
        assert "type" in item
        assert item["type"] == "expense"


class TestMappingsHaveFromAccount:
    """Scanner endpoint returns from_account in matched (mappings) items."""

    def test_matched_mapping_has_from_account(self, client, db, project_with_category):
        """Transaction that keyword-matches a budget category includes from_account in mappings."""
        account = models.Account(name="Eurobank", is_system_account=0)
        db.add(account)
        db.commit()
        db.refresh(account)

        # Use category name "Materials" in the description so the matcher picks it up
        tx = models.Transaction(
            project_id=project_with_category["project"]["id"],
            date=date(2025, 6, 1),
            amount=2000,
            description="Materials purchase from warehouse",
            budget_item_id=None,
            from_account_id=account.id,
            direction="out",
            type="expense",
        )
        db.add(tx)
        db.commit()
        db.refresh(tx)

        project_id = project_with_category["project"]["id"]
        res = client.post(f"/admin/budget-mapper/{project_id}?dry_run=true")
        assert res.status_code == 200
        data = res.json()

        assert data["total_matched"] >= 1
        mapping = next(
            (m for m in data["mappings"] if m["transaction_id"] == tx.id),
            None,
        )
        assert mapping is not None, "Transaction should appear in mappings list"
        assert "from_account" in mapping
        assert mapping["from_account"] == "Eurobank"


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
        # Create an income category for this test
        income_cat = models.BudgetCategory(
            project_id=project_with_category["project"]["id"],
            category_name="Customer Payment",
            planned_amount=0,
            category_type="income",
        )
        db.add(income_cat)
        db.commit()
        db.refresh(income_cat)

        res = client.put("/admin/bulk-assign-budget", json={
            "transaction_ids": [unmapped_transaction.id],
            "budget_category_id": income_cat.id,
            "direction": "in",
        })
        assert res.status_code == 200
        assert res.json()["updated"] == 1

        # Verify DB was updated
        db.expire_all()
        tx = db.query(models.Transaction).filter(models.Transaction.id == unmapped_transaction.id).first()
        assert tx.direction == "in"
        assert tx.type == "income"
        assert tx.budget_item_id == income_cat.id

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


class TestBulkAssignSetsStatusExecuted:
    """Bulk assign endpoint must set status='executed' so reports include the transactions."""

    def test_bulk_assign_sets_status_executed(self, client, db, project_with_category):
        """After bulk-assign, transaction.status must be 'executed' so reports include it."""
        tx = models.Transaction(
            project_id=project_with_category["project"]["id"],
            date=date(2025, 1, 20),
            amount=5000,
            direction="out",
            status=None,
            budget_item_id=None,
        )
        db.add(tx)
        db.commit()
        db.refresh(tx)

        category_id = project_with_category["category"].id
        response = client.put("/admin/bulk-assign-budget", json={
            "transaction_ids": [tx.id],
            "budget_category_id": category_id,
            "direction": "out",
        })
        assert response.status_code == 200

        db.expire_all()
        tx = db.query(models.Transaction).filter(models.Transaction.id == tx.id).first()
        assert tx.status == "executed"
        assert tx.budget_item_id == category_id
        assert tx.direction == "out"
        assert tx.type == "expense"

    def test_bulk_assign_overwrites_existing_status(self, client, db, project_with_category):
        """Even if status was something else, bulk-assign should set it to 'executed'."""
        income_cat = models.BudgetCategory(
            project_id=project_with_category["project"]["id"],
            category_name="Income Cat",
            planned_amount=0,
            category_type="income",
        )
        db.add(income_cat)
        db.commit()
        db.refresh(income_cat)

        tx = models.Transaction(
            project_id=project_with_category["project"]["id"],
            date=date(2025, 1, 25),
            amount=3000,
            direction="in",
            status="pending",
            budget_item_id=None,
        )
        db.add(tx)
        db.commit()
        db.refresh(tx)

        response = client.put("/admin/bulk-assign-budget", json={
            "transaction_ids": [tx.id],
            "budget_category_id": income_cat.id,
            "direction": "in",
        })
        assert response.status_code == 200

        db.expire_all()
        tx = db.query(models.Transaction).filter(models.Transaction.id == tx.id).first()
        assert tx.status == "executed"


class TestDirectionGuard:
    """Bulk assign rejects mismatched direction vs category_type."""

    def test_income_direction_to_expense_category_returns_400(self, client, db, project_with_category):
        """Assigning direction='in' to an expense category must return 400."""
        tx = models.Transaction(
            project_id=project_with_category["project"]["id"],
            date=date(2025, 3, 1),
            amount=1000,
            direction="in",
            budget_item_id=None,
        )
        db.add(tx)
        db.commit()
        db.refresh(tx)

        expense_cat_id = project_with_category["category"].id
        res = client.put("/admin/bulk-assign-budget", json={
            "transaction_ids": [tx.id],
            "budget_category_id": expense_cat_id,
            "direction": "in",
        })
        assert res.status_code == 400
        assert "Cannot assign" in res.json()["detail"]


class TestAutoMatcherDirectionFilter:
    """Auto-matcher does not return an expense category for an 'in' transaction."""

    def test_no_expense_category_for_income_tx(self, client, db, project_with_category):
        """An income transaction should not match an expense-only category."""
        tx = models.Transaction(
            project_id=project_with_category["project"]["id"],
            date=date(2025, 4, 1),
            amount=2000,
            category="Materials",
            description="Materials refund",
            direction="in",
            budget_item_id=None,
        )
        db.add(tx)
        db.commit()
        db.refresh(tx)

        project_id = project_with_category["project"]["id"]
        res = client.post(f"/admin/budget-mapper/{project_id}?dry_run=true")
        assert res.status_code == 200
        data = res.json()

        matched_item = next(
            (m for m in data["mappings"] if m["transaction_id"] == tx.id), None
        )
        # The "Materials" category is expense-type, so it should NOT match an 'in' tx
        if matched_item:
            assert matched_item["mapped_to_name"] != "Materials"


class TestLearningLoopMapping:
    """After bulk_assign_budget, AccountCategoryMapping row exists."""

    def test_mapping_created_after_bulk_assign(self, client, db, project_with_category):
        """Bulk assign creates an AccountCategoryMapping for (from_account_id, budget_category_id)."""
        account = models.Account(name="Eurobank", is_system_account=0)
        db.add(account)
        db.commit()
        db.refresh(account)

        tx = models.Transaction(
            project_id=project_with_category["project"]["id"],
            date=date(2025, 5, 1),
            amount=3000,
            direction="out",
            budget_item_id=None,
            from_account_id=account.id,
        )
        db.add(tx)
        db.commit()
        db.refresh(tx)

        category_id = project_with_category["category"].id
        res = client.put("/admin/bulk-assign-budget", json={
            "transaction_ids": [tx.id],
            "budget_category_id": category_id,
            "direction": "out",
        })
        assert res.status_code == 200

        mapping = db.query(models.AccountCategoryMapping).filter(
            models.AccountCategoryMapping.account_id == account.id,
            models.AccountCategoryMapping.budget_category_id == category_id,
        ).first()
        assert mapping is not None
        assert mapping.last_used is not None


class TestInlineCreateCategory:
    """POST /budget-categories/ with category_type='income' works correctly."""

    def test_create_income_category(self, client, sample_project):
        """Creating an income category returns it and it appears in the list."""
        pid = sample_project["id"]
        res = client.post("/budget-categories/", json={
            "project_id": pid,
            "category_name": "Rental Income",
            "category_type": "income",
            "planned_amount": 0,
        })
        assert res.status_code == 200
        data = res.json()
        assert data["category_name"] == "Rental Income"
        assert data["category_type"] == "income"

        # Verify it appears in the budget items list
        items_res = client.get(f"/projects/{pid}/budget-items")
        items = items_res.json()
        income_items = [i for i in items if i["category_type"] == "income"]
        names = [i["category_name"] for i in income_items]
        assert "Rental Income" in names
