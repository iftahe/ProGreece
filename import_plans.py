import pandas as pd
from datetime import datetime
from database import SessionLocal
import models
from decimal import Decimal
import os

# --- הגדרות ---
FILENAME = 'plans.csv'  # השם החדש והקצר
HEADER_ROW = 1          # ב-CSV שיצרנו, הכותרות הן בשורה 2 (אינדקס 1)

def parse_date(date_val):
    """מנסה לפרמט תאריך מכל פורמט אפשרי"""
    if pd.isna(date_val) or str(date_val).strip() == '':
        return None
    
    date_str = str(date_val).strip()
    
    # פורמטים נפוצים
    formats = [
        '%d/%m/%Y', '%Y-%m-%d', '%m/%d/%Y', '%d-%m-%Y', 
        '%d.%m.%Y', '%Y.%m.%d'
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None

def clean_amount(amount_val):
    if pd.isna(amount_val):
        return Decimal(0)
    s = str(amount_val).replace(',', '').replace('₪', '').replace('$', '').strip()
    try:
        return Decimal(s)
    except:
        return Decimal(0)

def import_plans():
    # בדיקה שהקובץ קיים לפני שמתחילים
    if not os.path.exists(FILENAME):
        print(f"ERROR: The file '{FILENAME}' was not found!")
        print("Please create the file 'plans.csv' in the project folder.")
        return

    db = SessionLocal()
    
    # 1. מציאת הפרויקט
    project = db.query(models.Project).first()
    if not project:
        print("Error: No projects found in DB.")
        return
    
    print(f"Importing plans for Project ID: {project.id} ({project.name})...")
    
    # 2. קריאת הקובץ
    try:
        # קריאת ה-CSV
        df = pd.read_csv(FILENAME, header=HEADER_ROW, encoding='utf-8-sig')
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return

    print("File read successfully. Processing rows...")
    
    count_income = 0
    count_expense = 0
    
    for index, row in df.iterrows():
        # --- תכנון הוצאות (Expenses) - צד שמאל ---
        # עמודות לפי ה-CSV שיצרנו: 
        # 0=פרויקט, 1=שלב, 2=קטגוריה, 3=תאריך, 4=סכום
        try:
            exp_date_raw = row.iloc[3] 
            exp_amount_raw = row.iloc[4]
            exp_phase_name = row.iloc[1]
            
            if not pd.isna(exp_amount_raw) and not pd.isna(exp_phase_name):
                exp_date = parse_date(exp_date_raw)
                amount = clean_amount(exp_amount_raw)
                
                if amount > 0 and exp_date:
                    expense_plan = models.ProjectPaymentPhase(
                        project_id=project.id,
                        name=str(exp_phase_name),
                        amount=amount,
                        target_date=exp_date,
                        status="Pending"
                    )
                    db.add(expense_plan)
                    count_expense += 1
        except IndexError:
            pass # התעלם משורות ריקות או קצרות

        # --- תכנון הכנסות (Income) - צד ימין ---
        # עמודות לפי ה-CSV שיצרנו:
        # 13=פרויקט, 14=שלב הכנסות, 15=לקוח, 16=תאריך, 17=סכום
        try:
            inc_date_raw = row.iloc[16]
            inc_amount_raw = row.iloc[17]
            inc_desc = row.iloc[14]
            
            if not pd.isna(inc_amount_raw) and not pd.isna(inc_desc):
                inc_date = parse_date(inc_date_raw)
                amount = clean_amount(inc_amount_raw)
                
                if amount > 0 and inc_date:
                    income_plan = models.CustomerPaymentPlan(
                        project_id=project.id,
                        manual_date=inc_date,
                        value=amount,
                        remarks=str(inc_desc)
                    )
                    db.add(income_plan)
                    count_income += 1
        except IndexError:
            pass

    db.commit()
    print(f"\nSuccess! Imported:")
    print(f"- {count_expense} Expense Plans")
    print(f"- {count_income} Income Plans")
    
    db.close()

if __name__ == "__main__":
    import_plans()