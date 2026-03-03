"""
End-to-end tests for Phase 4-8 implementation.

Covers: schema verification, counterparty/customer/invoice CRUD,
transaction enhancements (VAT/withholding auto-compute, direction, status),
all report endpoints, Excel export, forecast endpoints, bulk import,
and audit log verification.
"""
import io
import json
from datetime import datetime, date
from decimal import Decimal

import pytest
from sqlalchemy import inspect

import models


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_project(client, name="E2E Project"):
    res = client.post("/projects/", json={"name": name, "status": "Active", "account_balance": 50000.0})
    assert res.status_code == 200
    return res.json()


def _create_counterparty(client, name="Acme Builder", vat_number="EL123456"):
    res = client.post("/counterparties/", json={"name": name, "vat_number": vat_number})
    assert res.status_code == 200
    return res.json()


def _create_customer(client, full_name="Alice Doe", email="alice@example.com"):
    res = client.post("/customers/", json={"full_name": full_name, "email": email})
    assert res.status_code == 200
    return res.json()


def _create_invoice(client, project_id, invoice_number="INV-001", value=10000, **kwargs):
    payload = {
        "project_id": project_id,
        "invoice_number": invoice_number,
        "invoice_date": "2025-06-15",
        "invoice_value": value,
        **kwargs,
    }
    return client.post("/invoices/", json=payload)


def _create_transaction(client, project_id, amount=1000, **kwargs):
    payload = {
        "project_id": project_id,
        "date": "2025-06-01T00:00:00",
        "amount": amount,
        **kwargs,
    }
    res = client.post("/transactions/", json=payload)
    assert res.status_code == 200
    return res.json()


def _seed_full_scenario(client, db):
    """
    Build a complete data graph used by report / forecast / export tests.

    Returns a dict with IDs for: project, counterparty, customer, budget_category,
    apartment, payment, transactions (in + out), invoice.
    """
    proj = _create_project(client)
    pid = proj["id"]

    # Counterparty & Customer
    cp = _create_counterparty(client)
    cust = _create_customer(client)

    # Budget category (directly via DB — no POST endpoint)
    cat = models.BudgetCategory(
        project_id=pid, category_name="Construction", planned_amount=100000, category_type="expense"
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)

    # Apartment with customer_id link
    apt = models.Apartment(
        project_id=pid,
        name="Apt 101",
        apartment_number="101",
        unit_number="A-101",
        customer_name="Alice Doe",
        customer_id=cust["id"],
        sale_price=250000,
        sale_date=date(2025, 1, 15),
    )
    db.add(apt)
    db.commit()
    db.refresh(apt)

    # Customer payment on the apartment
    pmt = models.CustomerPayment(
        apartment_id=apt.id,
        date=datetime(2025, 3, 1),
        amount=100000,
        payment_method="Bank Transfer",
    )
    db.add(pmt)
    db.commit()
    db.refresh(pmt)

    # Outgoing transaction (expense) — has VAT + withholding
    tx_out = _create_transaction(
        client, pid,
        amount=5000,
        vat_rate=0.24,
        withholding_rate=0.03,
        direction="out",
        status="executed",
        counterparty_id=cp["id"],
        budget_item_id=cat.id,
        description="Concrete delivery",
    )

    # Incoming transaction (income from customer)
    tx_in = _create_transaction(
        client, pid,
        amount=80000,
        direction="in",
        status="executed",
        customer_id_fk=cust["id"],
        apartment_id=apt.id,
        description="Customer installment",
    )

    # Invoice linked to a transaction
    inv_res = _create_invoice(client, pid, invoice_number="INV-SEED", value=5000, counterparty_id=cp["id"])
    assert inv_res.status_code == 200
    inv = inv_res.json()

    # Link the outgoing transaction to the invoice
    link_res = client.post(f"/transactions/{tx_out['id']}/link-invoice?invoice_id={inv['id']}")
    assert link_res.status_code == 200

    # Budget plan (for forecast)
    bp = models.BudgetPlan(
        budget_category_id=cat.id,
        planned_date=datetime(2025, 7, 1),
        amount=20000,
        description="Phase 2 concrete",
    )
    db.add(bp)
    db.commit()

    return {
        "project_id": pid,
        "counterparty_id": cp["id"],
        "customer_id": cust["id"],
        "budget_category_id": cat.id,
        "apartment_id": apt.id,
        "payment_id": pmt.id,
        "tx_out_id": tx_out["id"],
        "tx_in_id": tx_in["id"],
        "invoice_id": inv["id"],
    }


# ===================================================================
# Section 1: Schema Verification
# ===================================================================

class TestSchemaVerification:
    def test_new_tables_exist(self, db):
        """counterparties, customers, invoices, audit_log tables must exist."""
        inspector = inspect(db.bind)
        tables = inspector.get_table_names()
        for expected in ("counterparties", "customers", "invoices", "audit_log"):
            assert expected in tables, f"Table '{expected}' missing"

    def test_transaction_phase4_columns(self, db):
        """Transaction model should have 12 Phase-4 columns."""
        inspector = inspect(db.bind)
        cols = {c["name"] for c in inspector.get_columns("transactions")}
        expected = {
            "vat_amount", "withholding_amount", "direction", "status",
            "counterparty_id", "customer_id_fk", "invoice_id",
            "source_ref", "currency", "updated_at", "created_by", "updated_by",
        }
        missing = expected - cols
        assert not missing, f"Missing transaction columns: {missing}"

    def test_apartment_phase4_columns(self, db):
        """Apartment model should have unit_number, customer_id, sale_date."""
        inspector = inspect(db.bind)
        cols = {c["name"] for c in inspector.get_columns("apartments")}
        for col in ("unit_number", "customer_id", "sale_date"):
            assert col in cols, f"Missing apartment column: {col}"

    def test_project_phase4_columns(self, db):
        """Project model should have is_active, cash_buffer, code, created_at, updated_at."""
        inspector = inspect(db.bind)
        cols = {c["name"] for c in inspector.get_columns("projects")}
        for col in ("is_active", "cash_buffer", "code", "created_at", "updated_at"):
            assert col in cols, f"Missing project column: {col}"

    def test_budget_category_phase4_columns(self, db):
        """BudgetCategory should have category_type."""
        inspector = inspect(db.bind)
        cols = {c["name"] for c in inspector.get_columns("budget_categories")}
        assert "category_type" in cols


# ===================================================================
# Section 2: Counterparty CRUD
# ===================================================================

class TestCounterpartyCRUD:
    def test_create_counterparty(self, client):
        cp = _create_counterparty(client, "Builder Co")
        assert cp["name"] == "Builder Co"
        assert cp["id"] > 0

    def test_list_counterparties(self, client):
        _create_counterparty(client, "A")
        _create_counterparty(client, "B")
        res = client.get("/counterparties/")
        assert res.status_code == 200
        assert len(res.json()) == 2

    def test_update_counterparty(self, client):
        cp = _create_counterparty(client, "Old Name")
        res = client.put(f"/counterparties/{cp['id']}", json={"name": "New Name"})
        assert res.status_code == 200
        assert res.json()["name"] == "New Name"

    def test_delete_counterparty_and_404(self, client):
        cp = _create_counterparty(client, "Temp")
        res = client.delete(f"/counterparties/{cp['id']}")
        assert res.status_code == 200
        # Delete again → 404
        res2 = client.delete(f"/counterparties/{cp['id']}")
        assert res2.status_code == 404


# ===================================================================
# Section 3: Customer CRUD
# ===================================================================

class TestCustomerCRUD:
    def test_create_customer(self, client):
        cust = _create_customer(client, "Bob Smith", "bob@test.com")
        assert cust["full_name"] == "Bob Smith"
        assert cust["id"] > 0

    def test_list_customers(self, client):
        _create_customer(client, "C1")
        _create_customer(client, "C2")
        res = client.get("/customers/")
        assert res.status_code == 200
        assert len(res.json()) == 2

    def test_update_customer(self, client):
        cust = _create_customer(client, "Old")
        res = client.put(f"/customers/{cust['id']}", json={"full_name": "New"})
        assert res.status_code == 200
        assert res.json()["full_name"] == "New"

    def test_delete_customer_and_404(self, client):
        cust = _create_customer(client, "Temp")
        res = client.delete(f"/customers/{cust['id']}")
        assert res.status_code == 200
        res2 = client.delete(f"/customers/{cust['id']}")
        assert res2.status_code == 404


# ===================================================================
# Section 4: Invoice CRUD
# ===================================================================

class TestInvoiceCRUD:
    def test_create_invoice_with_audit(self, client, db):
        proj = _create_project(client)
        res = _create_invoice(client, proj["id"], "INV-100", 5000)
        assert res.status_code == 200
        inv = res.json()
        assert inv["invoice_number"] == "INV-100"
        assert float(inv["invoice_value"]) == 5000

        # Verify audit log entry
        logs = db.query(models.AuditLog).filter(
            models.AuditLog.entity_type == "invoice",
            models.AuditLog.entity_id == inv["id"],
            models.AuditLog.action == "create",
        ).all()
        assert len(logs) == 1

    def test_list_invoices_with_filters(self, client):
        proj = _create_project(client)
        _create_invoice(client, proj["id"], "INV-A", 1000)
        _create_invoice(client, proj["id"], "INV-B", 2000)

        # List all
        res = client.get("/invoices/")
        assert res.status_code == 200
        assert len(res.json()) == 2

        # Filter by project
        res2 = client.get(f"/invoices/?project_id={proj['id']}")
        assert res2.status_code == 200
        assert len(res2.json()) == 2

    def test_update_invoice_with_audit(self, client, db):
        proj = _create_project(client)
        inv = _create_invoice(client, proj["id"], "INV-U", 3000).json()

        res = client.put(f"/invoices/{inv['id']}", json={
            "project_id": proj["id"],
            "invoice_number": "INV-U",
            "invoice_date": "2025-07-01",
            "invoice_value": 4000,
        })
        assert res.status_code == 200
        assert float(res.json()["invoice_value"]) == 4000

        logs = db.query(models.AuditLog).filter(
            models.AuditLog.entity_type == "invoice",
            models.AuditLog.entity_id == inv["id"],
            models.AuditLog.action == "update",
        ).all()
        assert len(logs) == 1

    def test_delete_invoice_with_audit(self, client, db):
        proj = _create_project(client)
        inv = _create_invoice(client, proj["id"], "INV-D", 1000).json()

        res = client.delete(f"/invoices/{inv['id']}")
        assert res.status_code == 200

        logs = db.query(models.AuditLog).filter(
            models.AuditLog.entity_type == "invoice",
            models.AuditLog.entity_id == inv["id"],
            models.AuditLog.action == "delete",
        ).all()
        assert len(logs) == 1

    def test_link_invoice_to_transaction(self, client):
        proj = _create_project(client)
        inv = _create_invoice(client, proj["id"], "INV-LNK", 2000).json()
        tx = _create_transaction(client, proj["id"], amount=2000)

        res = client.post(f"/transactions/{tx['id']}/link-invoice?invoice_id={inv['id']}")
        assert res.status_code == 200
        assert res.json()["invoice_id"] == inv["id"]

    def test_invoice_unique_constraint_violation(self, client):
        proj = _create_project(client)
        res1 = _create_invoice(client, proj["id"], "DUP-001", 1000)
        assert res1.status_code == 200

        # No explicit error handler → IntegrityError propagates as exception
        with pytest.raises(Exception):
            _create_invoice(client, proj["id"], "DUP-001", 2000)


# ===================================================================
# Section 5: Transaction Enhancements
# ===================================================================

class TestTransactionEnhancements:
    def test_vat_amount_auto_computed(self, client):
        proj = _create_project(client)
        tx = _create_transaction(client, proj["id"], amount=10000, vat_rate=0.24)
        assert float(tx["vat_amount"]) == pytest.approx(2400.0, abs=0.01)

    def test_withholding_amount_auto_computed(self, client):
        proj = _create_project(client)
        tx = _create_transaction(client, proj["id"], amount=10000, withholding_rate=0.03)
        assert float(tx["withholding_amount"]) == pytest.approx(300.0, abs=0.01)

    def test_direction_and_status_preserved(self, client):
        proj = _create_project(client)
        tx = _create_transaction(
            client, proj["id"], amount=5000, direction="in", status="planned"
        )
        assert tx["direction"] == "in"
        assert tx["status"] == "planned"

    def test_update_recomputes_vat_withholding(self, client):
        proj = _create_project(client)
        tx = _create_transaction(client, proj["id"], amount=1000, vat_rate=0.1, withholding_rate=0.05)
        assert float(tx["vat_amount"]) == pytest.approx(100.0, abs=0.01)

        # Update to new amount
        res = client.put(f"/transactions/{tx['id']}", json={
            "project_id": proj["id"],
            "date": "2025-06-01T00:00:00",
            "amount": 2000,
            "vat_rate": 0.1,
            "withholding_rate": 0.05,
        })
        assert res.status_code == 200
        updated = res.json()
        assert float(updated["vat_amount"]) == pytest.approx(200.0, abs=0.01)
        assert float(updated["withholding_amount"]) == pytest.approx(100.0, abs=0.01)

    def test_counterparty_and_customer_fk_stored(self, client):
        proj = _create_project(client)
        cp = _create_counterparty(client)
        cust = _create_customer(client)
        tx = _create_transaction(
            client, proj["id"], amount=500,
            counterparty_id=cp["id"], customer_id_fk=cust["id"],
        )
        assert tx["counterparty_id"] == cp["id"]
        assert tx["customer_id_fk"] == cust["id"]

    def test_source_ref_and_currency_preserved(self, client):
        proj = _create_project(client)
        tx = _create_transaction(
            client, proj["id"], amount=100,
            source_ref="BANK-REF-001", currency="USD",
        )
        assert tx["source_ref"] == "BANK-REF-001"
        assert tx["currency"] == "USD"


# ===================================================================
# Section 6: Report Endpoints
# ===================================================================

class TestReportEndpoints:
    def test_pnl_report(self, client, db):
        seed = _seed_full_scenario(client, db)
        res = client.get(f"/reports/pnl?project_id={seed['project_id']}")
        assert res.status_code == 200
        data = res.json()
        assert "rows" in data
        assert "totals" in data
        assert "filters_applied" in data
        assert "drilldown_supported" in data
        assert data["drilldown_supported"] is True
        # Should have at least one row from the seeded executed transactions
        # (P&L defaults to status='executed')
        assert len(data["rows"]) >= 1
        # Totals should have the expected keys
        for key in ("trans_value", "vat_value", "value_no_vat", "withholding_value"):
            assert key in data["totals"]

    def test_plan_vs_actual_report(self, client, db):
        seed = _seed_full_scenario(client, db)
        res = client.get(f"/reports/plan-vs-actual?project_id={seed['project_id']}")
        assert res.status_code == 200
        data = res.json()
        assert "rows" in data
        assert "totals" in data
        assert "drilldown_supported" in data
        assert data["drilldown_supported"] is True
        # Should have at least one row (Construction category)
        assert len(data["rows"]) >= 1
        row = data["rows"][0]
        assert "variance" in row
        assert "vat_amount" in row
        assert "withholding_amount" in row

    def test_invoices_report(self, client, db):
        seed = _seed_full_scenario(client, db)
        res = client.get(f"/reports/invoices?project_id={seed['project_id']}")
        assert res.status_code == 200
        data = res.json()
        assert "rows" in data
        assert "totals" in data
        assert "drilldown_supported" in data
        # Totals should have invoice_value and transactions_value
        for key in ("invoice_value", "transactions_value", "balance"):
            assert key in data["totals"]

    def test_customer_transactions_report(self, client, db):
        seed = _seed_full_scenario(client, db)
        res = client.get(f"/reports/customer-transactions?project_id={seed['project_id']}")
        assert res.status_code == 200
        data = res.json()
        assert "rows" in data
        assert "totals" in data
        assert "filters_applied" in data
        # The seeded tx_in has direction='in', status='executed', customer_id_fk set
        assert len(data["rows"]) >= 1
        assert float(data["totals"]["amount"]) > 0

    def test_customer_balance_report(self, client, db):
        seed = _seed_full_scenario(client, db)
        res = client.get(f"/reports/customer-balance?project_id={seed['project_id']}")
        assert res.status_code == 200
        data = res.json()
        assert "rows" in data
        assert "totals" in data
        assert "drilldown_supported" in data
        # Apartment has sale_price=250000, payment=100000 → remaining=150000
        assert len(data["rows"]) >= 1
        row = data["rows"][0]
        assert "sale_price" in row
        assert "received" in row
        assert "remaining" in row
        assert "pct_paid" in row
        assert float(row["sale_price"]) == 250000
        assert float(row["received"]) == 100000
        assert float(row["remaining"]) == 150000

    def test_payments_by_project_report(self, client, db):
        seed = _seed_full_scenario(client, db)
        res = client.get(f"/reports/payments-by-project?project_id={seed['project_id']}")
        assert res.status_code == 200
        data = res.json()
        assert "rows" in data
        assert "totals" in data
        # The seeded tx_out has direction='out'
        assert len(data["rows"]) >= 1
        assert float(data["totals"]["amount"]) > 0

    def test_vat_report(self, client, db):
        seed = _seed_full_scenario(client, db)
        res = client.get(f"/reports/vat?project_id={seed['project_id']}")
        assert res.status_code == 200
        data = res.json()
        assert "rows" in data
        assert "totals" in data
        # The seeded tx_out has vat_amount = 5000*0.24 = 1200
        assert len(data["rows"]) >= 1
        assert float(data["totals"]["vat_amount"]) > 0

    def test_withholding_report(self, client, db):
        seed = _seed_full_scenario(client, db)
        res = client.get(f"/reports/withholding?project_id={seed['project_id']}")
        assert res.status_code == 200
        data = res.json()
        assert "rows" in data
        assert "totals" in data
        # The seeded tx_out has withholding_amount = 5000*0.03 = 150
        assert len(data["rows"]) >= 1
        assert float(data["totals"]["withholding_amount"]) > 0


# ===================================================================
# Section 7: Excel Export
# ===================================================================

class TestExcelExport:
    def test_pnl_xlsx_export(self, client, db):
        seed = _seed_full_scenario(client, db)
        res = client.get(f"/reports/pnl?project_id={seed['project_id']}&format=xlsx")
        assert res.status_code == 200
        assert "spreadsheetml" in res.headers["content-type"]
        # XLSX files start with PK magic bytes
        assert res.content[:2] == b"PK"

    def test_invoices_xlsx_export(self, client, db):
        seed = _seed_full_scenario(client, db)
        res = client.get(f"/reports/invoices?project_id={seed['project_id']}&format=xlsx")
        assert res.status_code == 200
        assert "spreadsheetml" in res.headers["content-type"]
        assert res.content[:2] == b"PK"

    def test_vat_xlsx_loads_with_openpyxl(self, client, db):
        seed = _seed_full_scenario(client, db)
        res = client.get(f"/reports/vat?project_id={seed['project_id']}&format=xlsx")
        assert res.status_code == 200

        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(res.content))
        ws = wb.active
        # Header row should exist
        headers = [cell.value for cell in ws[1]]
        assert len(headers) > 0
        assert headers[0] is not None


# ===================================================================
# Section 8: Forecast Endpoints
# ===================================================================

class TestForecastEndpoints:
    def test_company_forecast(self, client, db):
        _seed_full_scenario(client, db)
        res = client.get("/reports/forecast/company")
        assert res.status_code == 200
        data = res.json()
        assert "months" in data
        assert "totals" in data
        # Should have 12 months in the window
        assert len(data["months"]) == 12
        # Totals keys
        for key in ("total_inflows", "total_outflows", "lowest_cash_point"):
            assert key in data["totals"]

    def test_projects_forecast(self, client, db):
        _seed_full_scenario(client, db)
        res = client.get("/reports/forecast/projects")
        assert res.status_code == 200
        data = res.json()
        assert "projects" in data
        assert len(data["projects"]) >= 1
        proj = data["projects"][0]
        for key in ("next_3_months_net", "next_6_months_net", "next_12_months_net", "lowest_cash_point"):
            assert key in proj
        assert "monthly" in proj
        assert len(proj["monthly"]) == 12


# ===================================================================
# Section 9: Bulk Import
# ===================================================================

class TestBulkImport:
    def _make_tx_csv(self, rows):
        headers = list(rows[0].keys())
        lines = [",".join(headers)]
        for row in rows:
            lines.append(",".join(str(row.get(h, "")) for h in headers))
        return "\n".join(lines).encode("utf-8")

    def test_csv_import(self, client):
        proj = _create_project(client)
        csv_data = self._make_tx_csv([
            {"date": "2025-08-01", "amount": "3000", "direction": "out",
             "description": "Import test", "status": "executed", "source_ref": "IMP-001"},
            {"date": "2025-08-02", "amount": "1500", "direction": "in",
             "description": "Import test 2", "status": "executed", "source_ref": "IMP-002"},
        ])

        res = client.post(
            f"/imports/transactions?project_id={proj['id']}",
            data={"project_id": str(proj["id"])},
            files={"file": ("transactions.csv", io.BytesIO(csv_data), "text/csv")},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["imported"] > 0

    def test_csv_import_duplicate_guard(self, client):
        proj = _create_project(client)
        csv_data = self._make_tx_csv([
            {"date": "2025-08-01", "amount": "3000", "direction": "out",
             "description": "Dup test", "status": "executed", "source_ref": "DUP-001"},
        ])

        # First import
        res1 = client.post(
            f"/imports/transactions?project_id={proj['id']}",
            data={"project_id": str(proj["id"])},
            files={"file": ("tx.csv", io.BytesIO(csv_data), "text/csv")},
        )
        assert res1.status_code == 200
        assert res1.json()["imported"] == 1

        # Second import with same source_ref
        csv_data2 = self._make_tx_csv([
            {"date": "2025-08-01", "amount": "3000", "direction": "out",
             "description": "Dup test", "status": "executed", "source_ref": "DUP-001"},
        ])
        res2 = client.post(
            f"/imports/transactions?project_id={proj['id']}",
            data={"project_id": str(proj["id"])},
            files={"file": ("tx.csv", io.BytesIO(csv_data2), "text/csv")},
        )
        assert res2.status_code == 200
        assert res2.json()["skipped"] > 0


# ===================================================================
# Section 10: Audit Log
# ===================================================================

class TestAuditLog:
    def test_transaction_create_audit(self, client, db):
        proj = _create_project(client)
        tx = _create_transaction(client, proj["id"], amount=999)
        logs = db.query(models.AuditLog).filter(
            models.AuditLog.entity_type == "transaction",
            models.AuditLog.entity_id == tx["id"],
            models.AuditLog.action == "create",
        ).all()
        assert len(logs) == 1
        assert logs[0].diff_json is not None

    def test_transaction_update_audit(self, client, db):
        proj = _create_project(client)
        tx = _create_transaction(client, proj["id"], amount=500)
        client.put(f"/transactions/{tx['id']}", json={
            "project_id": proj["id"],
            "date": "2025-06-01T00:00:00",
            "amount": 600,
        })
        logs = db.query(models.AuditLog).filter(
            models.AuditLog.entity_type == "transaction",
            models.AuditLog.entity_id == tx["id"],
            models.AuditLog.action == "update",
        ).all()
        assert len(logs) == 1

    def test_transaction_delete_audit(self, client, db):
        proj = _create_project(client)
        tx = _create_transaction(client, proj["id"], amount=300)
        tx_id = tx["id"]
        client.delete(f"/transactions/{tx_id}")
        logs = db.query(models.AuditLog).filter(
            models.AuditLog.entity_type == "transaction",
            models.AuditLog.entity_id == tx_id,
            models.AuditLog.action == "delete",
        ).all()
        assert len(logs) == 1

    def test_invoice_lifecycle_audit(self, client, db):
        proj = _create_project(client)
        inv = _create_invoice(client, proj["id"], "AUDIT-INV", 1000).json()

        # Update
        client.put(f"/invoices/{inv['id']}", json={
            "project_id": proj["id"],
            "invoice_number": "AUDIT-INV",
            "invoice_date": "2025-07-01",
            "invoice_value": 2000,
        })

        # Delete
        client.delete(f"/invoices/{inv['id']}")

        logs = db.query(models.AuditLog).filter(
            models.AuditLog.entity_type == "invoice",
            models.AuditLog.entity_id == inv["id"],
        ).order_by(models.AuditLog.id).all()

        # Should have 3 entries: create, update, delete
        assert len(logs) == 3
        actions = [l.action for l in logs]
        assert actions == ["create", "update", "delete"]
