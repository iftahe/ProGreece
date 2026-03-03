from sqlalchemy.orm import Session
from sqlalchemy import extract
from typing import List, Dict, Optional, Any
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP
from collections import defaultdict
import models


def compute_unpaid_balances(db: Session, project_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Computes unpaid balances for apartments that have a sale_price > 0.

    For each apartment:
      - sale_price: the total contract price
      - received: sum of all CustomerPayment amounts for that apartment
      - unpaid: sale_price - received
      - overdue: True if unpaid > 0 (balance still outstanding)

    Returns a list of dicts:
      [{apartment_id, apartment_name, project_id, sale_price, received, unpaid, overdue}]
    """
    apt_query = db.query(models.Apartment).filter(
        models.Apartment.sale_price != None,
        models.Apartment.sale_price > 0
    )
    if project_id:
        apt_query = apt_query.filter(models.Apartment.project_id == project_id)
    apartments = apt_query.all()

    # Build received-payment totals per apartment_id
    received_by_apt: Dict[int, Decimal] = defaultdict(lambda: Decimal(0))
    if apartments:
        apt_ids = [a.id for a in apartments]
        payments = (
            db.query(models.CustomerPayment)
            .filter(models.CustomerPayment.apartment_id.in_(apt_ids))
            .all()
        )
        for pmt in payments:
            amt = pmt.amount if pmt.amount is not None else Decimal(0)
            received_by_apt[pmt.apartment_id] += Decimal(str(amt))

    result = []
    for apt in apartments:
        sale_price = Decimal(str(apt.sale_price))
        received = received_by_apt[apt.id]
        unpaid = (sale_price - received).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        result.append({
            "apartment_id": apt.id,
            "apartment_name": apt.name,
            "project_id": apt.project_id,
            "sale_price": float(sale_price),
            "received": float(received),
            "unpaid": float(unpaid),
            "overdue": unpaid > Decimal(0),
        })
    return result


def generate_cash_flow_forecast(db: Session, project_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Generates a Cash Flow Forecast report.

    Logic:
    1. Fetch Executed Transactions (Actuals).
    2. Fetch Customer Payment Plans (Planned).
    3. Apply Rolling Logic: Unpaid past plans are moved to the current month.
    4. Fetch unpaid apartment balances and roll them into expected_collections for the current month.
    5. Aggregate by Month: Sum Income vs Expenses, split into actual/planned/expected_collections.
    6. Return JSON structure.
    """

    # ---------------------------------------------------------
    # 1. Fetch Data
    # ---------------------------------------------------------

    # Transactions
    tx_query = db.query(models.Transaction)
    if project_id:
        tx_query = tx_query.filter(models.Transaction.project_id == project_id)
    transactions = tx_query.all()

    # Payment Plans (Planned Income)
    plan_query = db.query(models.CustomerPaymentPlan)
    if project_id:
        plan_query = plan_query.filter(models.CustomerPaymentPlan.project_id == project_id)
    plans = plan_query.all()

    # Pre-fetch Account Types for fast lookup
    accounts = db.query(models.Account).all()
    account_map = {acc.id: acc for acc in accounts}

    def get_account_type_name(acc_id):
        if not acc_id or acc_id not in account_map:
            return None
        acc = account_map[acc_id]
        if acc.account_type:
            return acc.account_type.name
        return None

    # ---------------------------------------------------------
    # 2. Rolling Logic & Processing Plans
    # ---------------------------------------------------------

    current_date = datetime.now()
    current_month_start = datetime(current_date.year, current_date.month, 1)

    # Partial reconciliation: map phase_id -> total actual income amount
    actual_by_phase = defaultdict(Decimal)
    for tx in transactions:
        if tx.phase_id and tx.type and tx.type.strip().lower() == 'income':
            amount = tx.amount if tx.amount else Decimal(0)
            actual_by_phase[tx.phase_id] += Decimal(str(amount))

    monthly_data = defaultdict(lambda: {
        "actual_income": Decimal(0),
        "actual_expense": Decimal(0),
        "planned_income": Decimal(0),
        "planned_expense": Decimal(0),
        "expected_collections": Decimal(0),
    })

    # Process Plans with partial reconciliation
    for plan in plans:
        plan_value = Decimal(str(plan.value)) if plan.value else Decimal(0)
        if plan_value <= 0:
            continue

        # Check partial fulfillment: if actual >= planned, skip entirely
        actual_for_phase = actual_by_phase.get(plan.phase_id, Decimal(0))
        if actual_for_phase >= plan_value:
            continue  # Fully covered by actuals

        # Remainder = planned - actual (show only what's still expected)
        remainder = plan_value - actual_for_phase

        # Determine Date
        plan_date = plan.manual_date if plan.manual_date else None
        if not plan_date:
            continue

        # Rolling Logic
        if plan_date < current_month_start:
            effective_date = current_month_start
        else:
            effective_date = plan_date

        month_key = effective_date.strftime("%Y-%m")
        monthly_data[month_key]["planned_income"] += remainder

    # ---------------------------------------------------------
    # 2b. Process BudgetPlan entries (Planned Expenses)
    # ---------------------------------------------------------

    budget_plan_query = db.query(models.BudgetPlan).join(
        models.BudgetCategory,
        models.BudgetPlan.budget_category_id == models.BudgetCategory.id
    )
    if project_id:
        budget_plan_query = budget_plan_query.filter(models.BudgetCategory.project_id == project_id)
    budget_plans = budget_plan_query.all()

    # Compute actual spending per budget_category_id for proportional scaling
    actual_by_budget_cat = defaultdict(Decimal)
    for tx in transactions:
        if tx.budget_item_id and tx.transaction_type == 1:
            amt = tx.amount if tx.amount else Decimal(0)
            actual_by_budget_cat[tx.budget_item_id] += Decimal(str(amt))

    # Compute total planned per budget_category_id
    planned_by_budget_cat = defaultdict(Decimal)
    for bp in budget_plans:
        amt = bp.amount if bp.amount else Decimal(0)
        planned_by_budget_cat[bp.budget_category_id] += Decimal(str(amt))

    for bp in budget_plans:
        bp_date = bp.planned_date
        if not bp_date:
            continue

        # Rolling logic: if planned_date is in the past, roll to current month
        if bp_date < current_month_start:
            effective_date = current_month_start
        else:
            effective_date = bp_date

        month_key = effective_date.strftime("%Y-%m")
        amount = Decimal(str(bp.amount)) if bp.amount else Decimal(0)

        # Proportional scaling: reduce planned by actual spending ratio
        cat_id = bp.budget_category_id
        total_planned_cat = planned_by_budget_cat.get(cat_id, Decimal(0))
        total_actual_cat = actual_by_budget_cat.get(cat_id, Decimal(0))

        if total_planned_cat > 0 and total_actual_cat > 0:
            remaining_ratio = max(Decimal(0), (total_planned_cat - total_actual_cat) / total_planned_cat)
            amount = amount * remaining_ratio

        monthly_data[month_key]["planned_expense"] += amount

    # ---------------------------------------------------------
    # 2c. Expected Collections: unpaid apartment balances (overdue/outstanding)
    #     All outstanding balances are rolled into the current month.
    # ---------------------------------------------------------
    unpaid_balances = compute_unpaid_balances(db, project_id)
    current_month_key = current_month_start.strftime("%Y-%m")
    for entry in unpaid_balances:
        if entry["overdue"]:
            monthly_data[current_month_key]["expected_collections"] += Decimal(str(entry["unpaid"]))

    # ---------------------------------------------------------
    # 3. Process Transactions (Actuals)
    # ---------------------------------------------------------

    for tx in transactions:
        if not tx.date:
            continue

        month_key = tx.date.strftime("%Y-%m")
        amount = Decimal(str(tx.amount)) if tx.amount else Decimal(0)

        # Determine Direction (Income vs Expense)
        is_income = False
        is_expense = False

        if tx.type and tx.type.strip().lower() == 'income':
            is_income = True
        elif tx.type and tx.type.strip().lower() == 'expense':
            is_expense = True

        # Secondary check: if type field is missing, try account-type based classification
        if not is_income and not is_expense:
            to_acc = account_map.get(tx.to_account_id)
            from_acc = account_map.get(tx.from_account_id)

            to_type = ""
            if to_acc and to_acc.account_type:
                to_type = to_acc.account_type.name if hasattr(to_acc.account_type, 'name') else str(to_acc.account_type)

            from_type = ""
            if from_acc and from_acc.account_type:
                from_type = from_acc.account_type.name if hasattr(from_acc.account_type, 'name') else str(from_acc.account_type)

            if to_type and ("project" in to_type.lower() or "income" in to_type.lower()):
                is_income = True
            elif to_type and ("supplier" in to_type.lower() or "expense" in to_type.lower()):
                is_expense = True
            elif from_type and ("project" in from_type.lower()):
                is_expense = True
            else:
                # Default to expense if no classification could be determined
                is_expense = True

        if is_income:
            monthly_data[month_key]["actual_income"] += amount
        else:
            monthly_data[month_key]["actual_expense"] += amount

    # ---------------------------------------------------------
    # 4. Final Aggregation & Formatting
    # ---------------------------------------------------------

    all_months = sorted(monthly_data.keys())

    report = []
    cumulative_balance = Decimal(0)

    for month in all_months:
        data = monthly_data[month]

        actual_net = data["actual_income"] - data["actual_expense"]
        planned_net = data["planned_income"] - data["planned_expense"]
        expected_collections = data["expected_collections"]

        # Net flow = actual net + planned net + expected collections (unpaid balances)
        net_flow = actual_net + planned_net + expected_collections
        cumulative_balance += net_flow

        report.append({
            "date": month,
            "actual_income": float(data["actual_income"]),
            "actual_expense": float(data["actual_expense"]),
            "planned_income": float(data["planned_income"]),
            "planned_expense": float(data["planned_expense"]),
            "expected_collections": float(expected_collections),
            "net_flow": float(net_flow),
            "cumulative_balance": float(cumulative_balance),
        })

    return report


def generate_company_forecast(db: Session) -> Dict[str, Any]:
    """
    Generates a company-wide 12-month cash flow forecast, consolidated across all active projects.

    Returns:
      {
        months: [{month, inflows, outflows, net, cumulative_cash, cash_buffer_alert}],
        totals: {total_inflows, total_outflows, lowest_cash_point}
      }
    """
    from dateutil.relativedelta import relativedelta  # type: ignore

    # Determine the 12-month forward window
    today = datetime.now()
    window_start = datetime(today.year, today.month, 1)
    window_months = []
    for i in range(12):
        m = window_start + relativedelta(months=i)
        window_months.append(m.strftime("%Y-%m"))

    # Fetch all active projects
    projects = db.query(models.Project).filter(models.Project.is_active == 1).all()

    # Aggregate monthly data across all projects
    monthly_inflows: Dict[str, Decimal] = defaultdict(lambda: Decimal(0))
    monthly_outflows: Dict[str, Decimal] = defaultdict(lambda: Decimal(0))

    for project in projects:
        forecast = generate_cash_flow_forecast(db, project.id)
        for row in forecast:
            month = row["date"]
            if month not in window_months:
                continue
            # Inflows: actual_income + planned_income + expected_collections
            inflows = (
                Decimal(str(row["actual_income"]))
                + Decimal(str(row["planned_income"]))
                + Decimal(str(row["expected_collections"]))
            )
            # Outflows: actual_expense + planned_expense
            outflows = (
                Decimal(str(row["actual_expense"]))
                + Decimal(str(row["planned_expense"]))
            )
            monthly_inflows[month] += inflows
            monthly_outflows[month] += outflows

    # Determine global cash buffer threshold (sum of all project cash_buffer values)
    total_cash_buffer = Decimal(0)
    for project in projects:
        if project.cash_buffer is not None:
            total_cash_buffer += Decimal(str(project.cash_buffer))

    result_months = []
    cumulative_cash = Decimal(0)
    total_inflows = Decimal(0)
    total_outflows = Decimal(0)
    lowest_cash_point = None

    for month in window_months:
        inflows = monthly_inflows[month]
        outflows = monthly_outflows[month]
        net = inflows - outflows
        cumulative_cash += net
        total_inflows += inflows
        total_outflows += outflows

        if lowest_cash_point is None or cumulative_cash < lowest_cash_point:
            lowest_cash_point = cumulative_cash

        cash_buffer_alert = bool(
            cumulative_cash < Decimal(0)
            or (total_cash_buffer > 0 and cumulative_cash < total_cash_buffer)
        )

        result_months.append({
            "month": month,
            "inflows": float(inflows.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "outflows": float(outflows.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "net": float(net.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "cumulative_cash": float(cumulative_cash.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "cash_buffer_alert": cash_buffer_alert,
        })

    if lowest_cash_point is None:
        lowest_cash_point = Decimal(0)

    return {
        "months": result_months,
        "totals": {
            "total_inflows": float(total_inflows.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "total_outflows": float(total_outflows.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "lowest_cash_point": float(lowest_cash_point.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        },
    }


def generate_projects_forecast(db: Session) -> Dict[str, Any]:
    """
    Generates a per-project 12-month cash flow forecast comparison.

    Returns:
      {
        projects: [
          {
            project_id, project_name,
            monthly: [{month, inflows, outflows, net, cumulative_cash}],
            next_3_months_net, next_6_months_net, next_12_months_net, lowest_cash_point
          }
        ]
      }
    """
    from dateutil.relativedelta import relativedelta  # type: ignore

    today = datetime.now()
    window_start = datetime(today.year, today.month, 1)
    window_months = []
    for i in range(12):
        m = window_start + relativedelta(months=i)
        window_months.append(m.strftime("%Y-%m"))

    projects = db.query(models.Project).filter(models.Project.is_active == 1).all()

    result_projects = []

    for project in projects:
        # Build a fast lookup of forecast rows by month
        forecast_rows = generate_cash_flow_forecast(db, project.id)
        forecast_by_month: Dict[str, Dict] = {row["date"]: row for row in forecast_rows}

        monthly = []
        cumulative_cash = Decimal(0)
        lowest_cash_point: Optional[Decimal] = None
        next_3_net = Decimal(0)
        next_6_net = Decimal(0)
        next_12_net = Decimal(0)

        for idx, month in enumerate(window_months):
            row = forecast_by_month.get(month)
            if row:
                inflows = (
                    Decimal(str(row["actual_income"]))
                    + Decimal(str(row["planned_income"]))
                    + Decimal(str(row["expected_collections"]))
                )
                outflows = (
                    Decimal(str(row["actual_expense"]))
                    + Decimal(str(row["planned_expense"]))
                )
            else:
                inflows = Decimal(0)
                outflows = Decimal(0)

            net = inflows - outflows
            cumulative_cash += net

            # Accumulate window nets (idx 0..11 = months 1..12)
            next_12_net += net
            if idx < 6:
                next_6_net += net
            if idx < 3:
                next_3_net += net

            if lowest_cash_point is None or cumulative_cash < lowest_cash_point:
                lowest_cash_point = cumulative_cash

            monthly.append({
                "month": month,
                "inflows": float(inflows.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
                "outflows": float(outflows.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
                "net": float(net.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
                "cumulative_cash": float(cumulative_cash.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            })

        if lowest_cash_point is None:
            lowest_cash_point = Decimal(0)

        result_projects.append({
            "project_id": project.id,
            "project_name": project.name,
            "monthly": monthly,
            "next_3_months_net": float(next_3_net.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "next_6_months_net": float(next_6_net.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "next_12_months_net": float(next_12_net.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "lowest_cash_point": float(lowest_cash_point.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        })

    return {"projects": result_projects}
