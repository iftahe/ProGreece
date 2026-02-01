import sqlite3
import pandas as pd

conn = sqlite3.connect('greece_project.db')

print("\n=== 1. האם יש פרויקטים? ===")
df_proj = pd.read_sql("SELECT id, name FROM projects", conn)
print(df_proj.head(10))  # מציג 10 ראשונים

print("\n=== 2. האם יש תנועות וכמה? ===")
count = pd.read_sql("SELECT COUNT(*) as count FROM transactions", conn).iloc[0]['count']
print(f"סה''כ תנועות במערכת: {count}")

if count > 0:
    print("\n=== 3. הצצה לנתוני התנועות (האם חסר מידע?) ===")
    # אנחנו שולפים את הנתונים וגם בודקים לאיזה פרויקט הם שייכים
    query = """
    SELECT 
        t.id, 
        p.name as project_name, 
        t.date, 
        t.category, 
        t.amount, 
        t.type 
    FROM transactions t
    LEFT JOIN projects p ON t.project_id = p.id
    LIMIT 10
    """
    df_trans = pd.read_sql(query, conn)
    print(df_trans)

    print("\n=== 4. בדיקת קטגוריות (חשוב לתצוגה) ===")
    print(df_trans['category'].unique())

conn.close()
