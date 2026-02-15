from sqlalchemy.orm import Session
from sqlalchemy import extract
from typing import List, Dict, Optional, Any
from datetime import datetime
from decimal import Decimal
from collections import defaultdict
import models

def generate_cash_flow_forecast(db: Session, project_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Generates a Cash Flow Forecast report.
    
    Logic:
    1. Fetch Executed Transactions (Actuals).
    2. Fetch Customer Payment Plans (Planned).
    3. Apply Rolling Logic: Unpaid past plans are moved to the current month.
    4. Aggregate by Month: Sum Income vs Expenses.
    5. Return JSON structure.
    """
    
    # ---------------------------------------------------------
    # 1. Fetch Data
    # ---------------------------------------------------------
    
    # Transactions
    tx_query = db.query(models.Transaction)
    if project_id:
        tx_query = tx_query.filter(models.Transaction.project_id == project_id)
    # Filter for meaningful transactions (e.g., exclude non-financial if any)
    # Assuming all transactions in table are financial.
    transactions = tx_query.all()
    
    # Payment Plans (Planned Income mainly, but could be expenses if modeled that way? 
    # Usually CustomerPaymentPlan is Income).
    plan_query = db.query(models.CustomerPaymentPlan)
    if project_id:
        plan_query = plan_query.filter(models.CustomerPaymentPlan.project_id == project_id)
    plans = plan_query.all()

    # Pre-fetch Account Types for fast lookup
    # We need to determine if an account is "Project/Income" or "Supplier/Expense"
    # We'll create a mapping of account_id -> account_type_name (or similar)
    accounts = db.query(models.Account).all()
    account_map = {acc.id: acc for acc in accounts}
    
    # helper to check account type
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
            actual_by_phase[tx.phase_id] += amount

    monthly_data = defaultdict(lambda: {"actual_income": Decimal(0), "actual_expense": Decimal(0), "planned_income": Decimal(0), "planned_expense": Decimal(0)})

    # Process Plans with partial reconciliation
    for plan in plans:
        plan_value = plan.value if plan.value else Decimal(0)
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
            actual_by_budget_cat[tx.budget_item_id] += amt

    # Compute total planned per budget_category_id
    planned_by_budget_cat = defaultdict(Decimal)
    for bp in budget_plans:
        amt = bp.amount if bp.amount else Decimal(0)
        planned_by_budget_cat[bp.budget_category_id] += amt

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
        amount = bp.amount if bp.amount else Decimal(0)

        # Proportional scaling: reduce planned by actual spending ratio
        cat_id = bp.budget_category_id
        total_planned_cat = planned_by_budget_cat.get(cat_id, Decimal(0))
        total_actual_cat = actual_by_budget_cat.get(cat_id, Decimal(0))

        if total_planned_cat > 0 and total_actual_cat > 0:
            remaining_ratio = max(Decimal(0), (total_planned_cat - total_actual_cat) / total_planned_cat)
            amount = amount * remaining_ratio

        monthly_data[month_key]["planned_expense"] += amount

    # ---------------------------------------------------------
    # 3. Process Transactions (Actuals)
    # ---------------------------------------------------------
    
    for tx in transactions:
        if not tx.date:
            continue
            
        month_key = tx.date.strftime("%Y-%m")
        amount = tx.amount if tx.amount else Decimal(0)
        
        # Determine Direction (Income vs Expense)
        # Primary check: use the transaction's 'type' field (set by import script)
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
    
    # Get all unique months from both
    all_months = sorted(monthly_data.keys())
    
    report = []
    cumulative_balance = Decimal(0)
    
    for month in all_months:
        data = monthly_data[month]
        
        actual_net = data["actual_income"] - data["actual_expense"]
        planned_net = data["planned_income"] - data["planned_expense"]
        
        # Forecast for this month could be Actuals + Planned? 
        # Usually, if a month is in the past, verified actuals are used. 
        # If in future, planned is used.
        # The prompt says: "Generate a report that merges...".
        # Typically: Forecast = Actuals (if happened) + Planned (if not happened yet for that item).
        # Since we filtered out "fulfilled" plans, "Planned" here contains ONLY unfulfilled plans.
        # So it is safe to sum them? 
        # Yes, "Actuals" = what happened. "Planned" = what IS GOING TO happen (rolled over or future).
        # So Total Net Flow = Actual Net + Planned Net.
        
        net_flow = actual_net + planned_net
        cumulative_balance += net_flow
        
        report.append({
            "date": month,
            "actual_income": float(data["actual_income"]),
            "actual_expense": float(data["actual_expense"]),
            "planned_income": float(data["planned_income"]),
            "planned_expense": float(data["planned_expense"]),
            "net_flow": float(net_flow),
            "cumulative_balance": float(cumulative_balance)
        })
        
    return report
