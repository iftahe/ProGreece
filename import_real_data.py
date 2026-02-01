import pandas as pd
import sqlite3
import os
from datetime import datetime

# --- הגדרות שמות קבצים (ודא שהם תואמים למה שיש לך בתיקייה) ---
FILE_TRANSACTIONS = 'progreeace 34 - תנועות בפועל.csv'
FILE_PROJECTS = 'progreeace 34 - Appartment_price_upload.csv'
DB_NAME = 'greece_project.db'

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def parse_date(date_str):
    """ממיר תאריך מפורמט 7/12/2024 0:00 ל-YYYY-MM-DD"""
    try:
        # מנסה לפרסר DD/MM/YYYY
        return pd.to_datetime(date_str, dayfirst=True).strftime('%Y-%m-%d')
    except:
        return datetime.today().strftime('%Y-%m-%d')

def run_import():
    print("🚀 מתחיל בייבוא נתונים אמיתיים...")
    
    # בדיקת קיום קבצים
    if not os.path.exists(FILE_TRANSACTIONS) or not os.path.exists(FILE_PROJECTS):
        print(f"❌ שגיאה: אחד או יותר מקבצי ה-CSV חסרים בתיקייה.")
        return

    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. טעינת פרויקטים
    # ------------------
    print(f"📂 קורא קובץ פרויקטים: {FILE_PROJECTS}")
    try:
        df_projects = pd.read_csv(FILE_PROJECTS, encoding='utf-8-sig')
    except:
        df_projects = pd.read_csv(FILE_PROJECTS, encoding='cp1255') # ניסיון שני

    # יצירת מילון: מזהה ישן (ProjectKey) -> שם פרויקט (Project)
    # ננקה כפילויות של פרויקטים (אותו פרויקט מופיע כמה פעמים עבור דירות שונות)
    project_map = df_projects[['ProjectKey', 'Project']].drop_duplicates().set_index('ProjectKey')['Project'].to_dict()
    
    print(f"✅ זוהו {len(project_map)} פרויקטים ייחודיים.")

    # הכנסת הפרויקטים ל-DB (אם לא קיימים)
    for p_key, p_name in project_map.items():
        if pd.isna(p_name): continue
        p_name = str(p_name).strip()
        cursor.execute("INSERT OR IGNORE INTO projects (name, status) VALUES (?, ?)", (p_name, 'Active'))
    
    conn.commit()

    # שליפת המזהים החדשים מה-DB (שם -> ID חדש)
    cursor.execute("SELECT id, name FROM projects")
    db_projects = {row['name']: row['id'] for row in cursor.fetchall()}

    # 2. טעינת תנועות
    # ---------------
    print(f"📂 קורא קובץ תנועות: {FILE_TRANSACTIONS}")
    try:
        df_trans = pd.read_csv(FILE_TRANSACTIONS, encoding='utf-8-sig')
    except:
        df_trans = pd.read_csv(FILE_TRANSACTIONS, encoding='cp1255')

    count_inserted = 0
    for index, row in df_trans.iterrows():
        try:
            # שליפת נתונים
            old_proj_key = row.get('project key')
            if pd.isna(old_proj_key): continue
            
            # איתור הפרויקט במערכת החדשה
            proj_name = project_map.get(old_proj_key)
            if not proj_name: continue
            
            new_project_id = db_projects.get(proj_name)
            if not new_project_id: continue

            # המרת נתונים
            amount = float(row.get('Amount', 0))
            if pd.isna(amount) or amount == 0: continue

            date_val = parse_date(row.get('Date'))
            category = str(row.get('Phaze', 'General')) # Phaze -> Category
            description = str(row.get('Remarks', ''))
            supplier = str(row.get('to', '')) # 'to' field -> Supplier

            # הכנסה לטבלה
            cursor.execute("""
                INSERT INTO transactions (project_id, date, amount, category, description, supplier, type)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (new_project_id, date_val, amount, category, description, supplier, 'expense'))
            
            count_inserted += 1

        except Exception as e:
            print(f"⚠️ דילגתי על שורה {index}: {e}")

    conn.commit()
    print(f"✅ הושלם! יובאו {count_inserted} תנועות בהצלחה.")
    
    # 3. יצירת קטגוריות תקציב לפרויקטים החדשים
    # ----------------------------------------
    print("🔧 מעדכן קטגוריות תקציב...")
    try:
        from services.budget_report_service import initialize_project_budget
        for p_name, p_id in db_projects.items():
            initialize_project_budget(p_id)
        print("✅ תקציבים אותחלו.")
    except Exception as e:
        print(f"⚠️ לא הצלחתי לאתחל תקציבים אוטומטית (לא נורא, יקרה בכניסה הבאה): {e}")

    conn.close()

if __name__ == "__main__":
    run_import()