from database import SessionLocal
from models import BudgetCategory
from datetime import date
from decimal import Decimal

def fix_budget_categories():
    db = SessionLocal()
    project_id = 1
    
    print(f"Cleaning old budget items for Project {project_id}...")
    # מחיקת נתונים ישנים אם יש (כדי למנוע כפילויות)
    db.query(BudgetCategory).filter(BudgetCategory.project_id == project_id).delete()
    db.commit()

    print("Adding 'Buying' Phase...")
    # 1. יצירת שלב הקנייה (אבא)
    buying_phase = BudgetCategory(
        project_id=project_id,
        name="Buying",
        amount=Decimal(500000),
        date=date(2025, 1, 1)
    )
    db.add(buying_phase)
    db.commit() # שומרים כדי לקבל את ה-ID שלו
    db.refresh(buying_phase)

    # 2. יצירת הילדים של הקנייה
    buying_items = ["License", "Realtor", "Law", "Buy Tax", "Notary"]
    for item_name in buying_items:
        item = BudgetCategory(
            project_id=project_id,
            name=item_name,
            parent_id=buying_phase.id, # קישור לאבא
            amount=Decimal(50000),
            date=date(2025, 2, 1)
        )
        db.add(item)
    
    print("Adding 'Construction' Phase...")
    # 3. יצירת שלב הבנייה (אבא)
    const_phase = BudgetCategory(
        project_id=project_id,
        name="Construction",
        amount=Decimal(2000000),
        date=date(2025, 6, 1)
    )
    db.add(const_phase)
    db.commit()
    db.refresh(const_phase)

    # 4. יצירת הילדים של הבנייה
    const_items = ["Construction", "Materials", "Architect"]
    for item_name in const_items:
        item = BudgetCategory(
            project_id=project_id,
            name=item_name,
            parent_id=const_phase.id, # קישור לאבא
            amount=Decimal(100000),
            date=date(2025, 7, 1)
        )
        db.add(item)

    db.commit()
    db.close()
    print("✅ SUCCESS! Budget Categories created.")

if __name__ == "__main__":
    fix_budget_categories()
    