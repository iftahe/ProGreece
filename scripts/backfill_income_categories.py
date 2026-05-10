"""
Backfill script: create income-type budget categories for projects that lack them,
and map unmapped income transactions to appropriate categories.

Usage:
    python scripts/backfill_income_categories.py          # dry-run (default)
    python scripts/backfill_income_categories.py --apply  # commit changes
"""
import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from datetime import datetime
from database import SessionLocal
import models


INCOME_CATEGORIES = ["Apartment Sale", "Trust Deposit", "Customer Payment", "ProGreece Income"]

CUSTOMER_ACCOUNT_NAMES = {
    "shira gefen", "avital rosenberger", "tal granit reina",
    "lucia paula feldstein weiss", "alexandru kotovski miclescu",
}


def classify_by_account_name(account_name: str) -> str:
    if not account_name:
        return "ProGreece Income"
    name_lower = account_name.strip().lower()
    if "trust" in name_lower:
        return "Trust Deposit"
    if name_lower in CUSTOMER_ACCOUNT_NAMES:
        return "Customer Payment"
    return "ProGreece Income"


def run_backfill(db: Session, apply: bool) -> dict:
    results = []

    projects = db.query(models.Project).all()
    for project in projects:
        income_txs = db.query(models.Transaction).filter(
            models.Transaction.project_id == project.id,
            models.Transaction.direction == "in",
        ).all()

        existing_income_cats = db.query(models.BudgetCategory).filter(
            models.BudgetCategory.project_id == project.id,
            models.BudgetCategory.category_type == "income",
        ).all()

        if not income_txs and not existing_income_cats:
            continue

        existing_names = {c.category_name for c in existing_income_cats}
        created_categories = []

        # Step 1: Create missing income categories (idempotent)
        for cat_name in INCOME_CATEGORIES:
            if cat_name not in existing_names:
                if apply:
                    cat = models.BudgetCategory(
                        project_id=project.id,
                        category_name=cat_name,
                        planned_amount=0,
                        category_type="income",
                    )
                    db.add(cat)
                created_categories.append(cat_name)

        if apply and created_categories:
            db.commit()

        # Reload categories after creation
        all_income_cats = db.query(models.BudgetCategory).filter(
            models.BudgetCategory.project_id == project.id,
            models.BudgetCategory.category_type == "income",
        ).all()
        cat_by_name = {c.category_name: c for c in all_income_cats}
        # In dry-run, categories don't exist yet but would be created
        available_names = set(cat_by_name.keys()) | set(INCOME_CATEGORIES)

        # Step 1b: Fix cross-direction mismatches (direction='in' but linked to expense category)
        cross_direction = db.query(models.Transaction).filter(
            models.Transaction.project_id == project.id,
            models.Transaction.direction == "in",
            models.Transaction.budget_item_id != None,
            models.Transaction.budget_item_id != 0,
        ).all()

        remapped_count = 0
        for tx in cross_direction:
            linked_cat = db.query(models.BudgetCategory).filter(
                models.BudgetCategory.id == tx.budget_item_id
            ).first()
            if not linked_cat or (linked_cat.category_type or "expense") != "expense":
                continue

            account_name = None
            if tx.from_account_id:
                acct = db.query(models.Account).filter(
                    models.Account.id == tx.from_account_id
                ).first()
                if acct:
                    account_name = acct.name

            target_name = classify_by_account_name(account_name)
            if target_name not in available_names:
                continue

            if apply:
                target_cat = cat_by_name.get(target_name)
                if not target_cat:
                    continue
                tx.budget_item_id = target_cat.id
                tx.type = "income"

                if tx.from_account_id:
                    existing_mapping = db.query(models.AccountCategoryMapping).filter(
                        models.AccountCategoryMapping.account_id == tx.from_account_id,
                        models.AccountCategoryMapping.budget_category_id == target_cat.id,
                    ).first()
                    if existing_mapping:
                        existing_mapping.last_used = datetime.now()
                    else:
                        db.add(models.AccountCategoryMapping(
                            account_id=tx.from_account_id,
                            budget_category_id=target_cat.id,
                            last_used=datetime.now(),
                        ))

            remapped_count += 1

        if apply and remapped_count > 0:
            db.commit()

        # Step 2: Map unmapped income transactions
        unmapped = db.query(models.Transaction).filter(
            models.Transaction.project_id == project.id,
            models.Transaction.direction == "in",
            (models.Transaction.budget_item_id == None) | (models.Transaction.budget_item_id == 0),
        ).all()

        mapped_count = 0
        for tx in unmapped:
            account_name = None
            if tx.from_account_id:
                acct = db.query(models.Account).filter(
                    models.Account.id == tx.from_account_id
                ).first()
                if acct:
                    account_name = acct.name

            target_name = classify_by_account_name(account_name)
            if target_name not in available_names:
                continue

            if apply:
                target_cat = cat_by_name.get(target_name)
                if not target_cat:
                    continue
                tx.budget_item_id = target_cat.id
                tx.status = "executed"
                tx.direction = "in"
                tx.type = "income"

                # Upsert account→category mapping for learning loop
                if tx.from_account_id:
                    existing_mapping = db.query(models.AccountCategoryMapping).filter(
                        models.AccountCategoryMapping.account_id == tx.from_account_id,
                        models.AccountCategoryMapping.budget_category_id == target_cat.id,
                    ).first()
                    if existing_mapping:
                        existing_mapping.last_used = datetime.now()
                    else:
                        db.add(models.AccountCategoryMapping(
                            account_id=tx.from_account_id,
                            budget_category_id=target_cat.id,
                            last_used=datetime.now(),
                        ))

            mapped_count += 1

        if apply and mapped_count > 0:
            db.commit()

        results.append({
            "project_id": project.id,
            "project_name": project.name,
            "created_categories": created_categories,
            "remapped_cross_direction": remapped_count,
            "mapped_transactions": mapped_count,
        })

    return {
        "dry_run": not apply,
        "projects": [r for r in results if r["created_categories"] or r["remapped_cross_direction"] or r["mapped_transactions"]],
    }


def main():
    parser = argparse.ArgumentParser(description="Backfill income categories and map income transactions")
    parser.add_argument("--apply", action="store_true", help="Commit changes (default is dry-run)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        report = run_backfill(db, apply=args.apply)

        mode = "APPLY" if args.apply else "DRY-RUN"
        print(f"\n=== Backfill Income Categories ({mode}) ===\n")

        if not report["projects"]:
            print("No projects need backfilling.")
            return

        for p in report["projects"]:
            print(f"Project {p['project_id']} ({p['project_name']}):")
            if p["created_categories"]:
                print(f"  Created categories: {', '.join(p['created_categories'])}")
            if p["remapped_cross_direction"]:
                print(f"  Remapped {p['remapped_cross_direction']} cross-direction transactions")
            print(f"  Mapped transactions: {p['mapped_transactions']}")
            print()

        total_cats = sum(len(p["created_categories"]) for p in report["projects"])
        total_remapped = sum(p["remapped_cross_direction"] for p in report["projects"])
        total_mapped = sum(p["mapped_transactions"] for p in report["projects"])
        print(f"Total: {total_cats} categories created, {total_remapped} cross-direction remapped, {total_mapped} transactions mapped")
    finally:
        db.close()


if __name__ == "__main__":
    main()
