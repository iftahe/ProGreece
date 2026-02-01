import sqlite3
import pandas as pd

DB_NAME = 'greece_project.db'
PROJECT_NAME = 'Karaoli_3_4'

def check_project():
    conn = sqlite3.connect(DB_NAME)
    
    print(f"\n🔍 בודק את הפרויקט: {PROJECT_NAME}")
    print("-" * 40)

    # 1. בדיקת קיום הפרויקט וה-ID שלו
    try:
        project = pd.read_sql(f"SELECT * FROM projects WHERE name LIKE '%Karaoli%'", conn)
        if project.empty:
            print("❌ הפרויקט לא נמצא בטבלה בכלל!")
            return
        else:
            print("✅ הפרויקט קיים במערכת:")
            print(project)
            project_id = project.iloc[0]['id']
            print(f"\n🆔 המזהה (ID) של הפרויקט הוא: {project_id}")
    except Exception as e:
        print(f"❌ שגיאה בשליפת פרויקט: {e}")
        return

    # 2. בדיקת תקציב (Budget Categories)
    budget = pd.read_sql(f"SELECT * FROM budget_categories WHERE project_id = {project_id}", conn)
    print(f"\n💰 שורות תקציב שנמצאו: {len(budget)}")
    if not budget.empty:
        print(budget[['category_name', 'planned_amount']].head())
    else:
        print("⚠️ התקציב ריק! (זה מסביר למה הגרף ריק)")

    # 3. בדיקת תנועות כספיות (Transactions)
    trans = pd.read_sql(f"SELECT * FROM transactions WHERE project_id = {project_id}", conn)
    print(f"\n💸 תנועות כספיות שנמצאו: {len(trans)}")
    
    if not trans.empty:
        print(trans[['date', 'category', 'amount', 'description']].head())
    else:
        print("⚠️ לא נמצאו תנועות לפרויקט הזה!")
        
        # 4. בדיקת רחבה: האם יש תנועות בכלל במערכת? ולמי הן שייכות?
        print("\n🔎 בדיקה כללית: לאיזה פרויקטים כן יש תנועות?")
        summary = pd.read_sql("""
            SELECT p.name, COUNT(t.id) as trans_count 
            FROM transactions t 
            JOIN projects p ON t.project_id = p.id 
            GROUP BY p.name
        """, conn)
        print(summary)

    conn.close()

if __name__ == "__main__":
    check_project()