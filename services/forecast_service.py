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
    
    # We need to check if a plan is fulfilled.
    # Assumption: A plan is fulfilled if there is a transaction with the same phase_id.
    # We will build a set of fulfilled phase_ids from transactions.
    fulfilled_phase_ids = set()
    for tx in transactions:
        if tx.phase_id:
            fulfilled_phase_ids.add(tx.phase_id)
            
    monthly_data = defaultdict(lambda: {"actual_income": Decimal(0), "actual_expense": Decimal(0), "planned_income": Decimal(0), "planned_expense": Decimal(0)})

    # Process Plans
    for plan in plans:
        # Check if fulfilled
        if plan.phase_id in fulfilled_phase_ids:
            continue # Already happened, so it's in "Actuals" (Transactions)
            
        # Determine Date
        plan_date = plan.manual_date if plan.manual_date else None
        # Fallback if manual_date is missing? Assuming manual_date is the key date.
        if not plan_date:
            continue
            
        # Rolling Logic
        # If plan is in the past, move to current month
        if plan_date < current_month_start:
            effective_date = current_month_start
        else:
            effective_date = plan_date
            
        # Aggregate
        month_key = effective_date.strftime("%Y-%m")
        
        # Payment Plans are typically Income (Customer Payments)
        # We assume positive value for Income.
        value = plan.value if plan.value else Decimal(0)
        monthly_data[month_key]["planned_income"] += value

    # ---------------------------------------------------------
    # 3. Process Transactions (Actuals)
    # ---------------------------------------------------------
    
    for tx in transactions:
        if not tx.date:
            continue
            
        month_key = tx.date.strftime("%Y-%m")
        amount = tx.amount if tx.amount else Decimal(0)
        
        # Determine Direction (Income vs Expense)
        # User Rule 1: Income: If to_account is a Project/Income account -> Positive (+)
        # User Rule 2: Expense: If to_account is a Supplier/Expense account (or from_account is the Project) -> Negative (-)
        
        # We need heuristics for "Project/Income account" vs "Supplier/Expense account"
        # Since we don't have hardcoded IDs, we will try to match strings or assume Project accounts are specific types.
        # Let's inspect what we typically have.
        # "Project/Income" often implies the account belongs to the project or is a revenue account.
        # "Supplier/Expense" implies external.
        
        to_acc = account_map.get(tx.to_account_id)
        from_acc = account_map.get(tx.from_account_id)
        
        to_type = ""
        if to_acc and to_acc.account_type:
            to_type = to_acc.account_type.name if hasattr(to_acc.account_type, 'name') else str(to_acc.account_type)
        
        from_type = ""
        if from_acc and from_acc.account_type:
            from_type = from_acc.account_type.name if hasattr(from_acc.account_type, 'name') else str(from_acc.account_type)
        
        is_income = False
        is_expense = False
        
        # Refined Logic based on user prompt:
        # "to_account is a Project/Income account"
        # usage of string matching for robustness
        if to_type and ("project" in to_type.lower() or "income" in to_type.lower() or "bank" in to_type.lower() and "project" in (to_acc.name or "").lower()):
             is_income = True
        
        # "to_account is a Supplier/Expense account"
        elif to_type and ("supplier" in to_type.lower() or "expense" in to_type.lower()):
            is_expense = True
            
        # "from_account is the Project" -> Expense (paying out)
        elif from_type and ("project" in from_type.lower()):
             is_expense = True
             
        # Fallback/Default behavior if ambiguous? 
        # For now, let's treat unknown as Expense if it's not clearly Income, to be conservative? 
        # Or maybe just skip? Let's check if 'transaction_type' helps.
        # Legacy DB might have transaction_type.
        
        if is_income:
            monthly_data[month_key]["actual_income"] += amount
        elif is_expense:
            monthly_data[month_key]["actual_expense"] += amount
        else:
            # If we can't determine, we might check the 'transaction_type' column if it exists and carries meaning.
            # For now, if we can't determine, maybe we treat it as expense or ignore?
            # Let's assume it's an expense if it's an outgoing flow not captured above.
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
