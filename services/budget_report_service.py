from sqlalchemy.orm import Session
from typing import List, Dict, Optional, Any
from decimal import Decimal
import models


def generate_budget_report(db: Session, project_id: int) -> List[Dict[str, Any]]:
    """
    Generates a Budget Report showing:
    - Budget categories (both parent phases and child categories)
    - Planned budget amounts
    - Actual amounts (from transactions)
    - Variances (Actual - Planned)
    - Progress percentages
    - Parent totals (sum of children)
    """
    
    # Fetch all budget categories for the project
    categories = db.query(models.BudgetCategory).filter(
        models.BudgetCategory.project_id == project_id
    ).all()
    
    # Fetch all transactions for the project
    transactions = db.query(models.Transaction).filter(
        models.Transaction.project_id == project_id
    ).all()
    
    # Build a map of category_id -> list of transactions
    # Only count executed transactions (transaction_type = 1) for actuals
    category_transactions = {}
    for tx in transactions:
        if tx.budget_item_id and tx.transaction_type == 1:  # Only executed transactions
            if tx.budget_item_id not in category_transactions:
                category_transactions[tx.budget_item_id] = []
            category_transactions[tx.budget_item_id].append(tx)
    
    # Calculate actual amounts per category
    # Use absolute values since budget categories are typically expense categories
    category_actuals = {}
    for category_id, txs in category_transactions.items():
        # Sum absolute values of transaction amounts for this category
        total = sum(abs(Decimal(str(tx.amount))) if tx.amount else Decimal(0) for tx in txs)
        category_actuals[category_id] = total
    
    # Build hierarchy and calculate parent totals
    # Separate parents (phases) and children
    parents = [cat for cat in categories if cat.parent_id is None]
    children_map = {}
    for cat in categories:
        if cat.parent_id:
            if cat.parent_id not in children_map:
                children_map[cat.parent_id] = []
            children_map[cat.parent_id].append(cat)
    
    report = []
    
    # Process each parent (phase)
    for parent in sorted(parents, key=lambda x: x.id):
        # Calculate children totals
        children = children_map.get(parent.id, [])
        children_planned_total = sum(Decimal(str(child.amount)) if child.amount else Decimal(0) for child in children)
        children_actual_total = sum(category_actuals.get(child.id, Decimal(0)) for child in children)
        
        # Parent planned: use parent's own amount if set, otherwise sum of children
        parent_planned = Decimal(str(parent.amount)) if parent.amount else Decimal(0)
        effective_planned = parent_planned if parent_planned > 0 else children_planned_total
        
        # Parent actual: sum of children's actuals (parents typically don't have direct transactions)
        # But also include parent's own transactions if any
        parent_actual = category_actuals.get(parent.id, Decimal(0))
        effective_actual = children_actual_total + parent_actual
        
        variance = effective_actual - effective_planned
        progress = (float(effective_actual) / float(effective_planned) * 100) if effective_planned > 0 else 0
        
        report.append({
            "id": parent.id,
            "name": parent.name,
            "parent_id": None,
            "is_parent": True,
            "planned": float(effective_planned),
            "actual": float(effective_actual),
            "variance": float(variance),
            "progress": progress,
            "children_planned_total": float(children_planned_total),
            "children_actual_total": float(children_actual_total)
        })
        
        # Add children rows
        for child in sorted(children, key=lambda x: x.id):
            child_planned = Decimal(str(child.amount)) if child.amount else Decimal(0)
            child_actual = category_actuals.get(child.id, Decimal(0))
            child_variance = child_actual - child_planned
            child_progress = (float(child_actual) / float(child_planned) * 100) if child_planned > 0 else 0
            
            report.append({
                "id": child.id,
                "name": child.name,
                "parent_id": child.parent_id,
                "is_parent": False,
                "planned": float(child_planned),
                "actual": float(child_actual),
                "variance": float(child_variance),
                "progress": child_progress,
                "children_planned_total": None,
                "children_actual_total": None
            })
    
    return report
