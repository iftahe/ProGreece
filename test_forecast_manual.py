"""
Tests for the forecast service (cash flow forecast generation).
Uses in-memory SQLite via conftest fixtures for proper test isolation.
"""
from datetime import datetime, timedelta
from decimal import Decimal

import models
import services.forecast_service


def test_forecast(db):
    """Test cash flow forecast with actuals and planned payments."""
    # 1. Create Project
    p = models.Project(name="Test Project", status="Active")
    db.add(p)
    db.commit()
    db.refresh(p)

    # 2. Create Account Types & Accounts
    at_proj = models.AccountType(name="Project Account")
    at_supp = models.AccountType(name="Supplier")
    db.add_all([at_proj, at_supp])
    db.commit()

    acc_proj = models.Account(name="My Project Bank", account_type=at_proj)
    acc_supp = models.Account(name="Big Supplier", account_type=at_supp)
    db.add_all([acc_proj, acc_supp])
    db.commit()

    # 3. Create Transactions (Actuals)
    t1 = models.Transaction(
        project_id=p.id,
        date=datetime.now() - timedelta(days=60),
        amount=Decimal(1000),
        to_account_id=acc_proj.id,
        remarks="Initial Deposit",
    )

    t2 = models.Transaction(
        project_id=p.id,
        date=datetime.now() - timedelta(days=30),
        amount=Decimal(500),
        from_account_id=acc_proj.id,
        to_account_id=acc_supp.id,
        remarks="Material Cost",
    )

    db.add_all([t1, t2])
    db.commit()

    # 4. Create Payment Plans (Planned)
    past_date = datetime.now() - timedelta(days=45)
    plan_unpaid_past = models.CustomerPaymentPlan(
        project_id=p.id,
        manual_date=past_date,
        value=Decimal(2000),
        remarks="Late Payment",
    )

    future_date = datetime.now() + timedelta(days=30)
    plan_future = models.CustomerPaymentPlan(
        project_id=p.id,
        manual_date=future_date,
        value=Decimal(3000),
        remarks="Future Installment",
    )

    db.add_all([plan_unpaid_past, plan_future])
    db.commit()

    # Run forecast
    report = services.forecast_service.generate_cash_flow_forecast(db, p.id)

    # Validate
    assert len(report) > 0, "Report should contain at least one month"

    current_month_str = datetime.now().strftime("%Y-%m")
    current_month_row = None
    for row in report:
        if row["date"] == current_month_str:
            current_month_row = row
            break

    # The rolling logic should move the 2000 past plan to the current month
    assert current_month_row is not None, "Current month should be in the report"
    assert current_month_row["planned_income"] >= 2000, (
        f"Rolling logic failed: planned_income={current_month_row['planned_income']}, expected >= 2000"
    )
