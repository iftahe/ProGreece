import sqlite3

DB_NAME = 'greece_project.db'

def clean_database():
    print("🧹 מתחיל בניקוי יסודי של הנתונים...")
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    # 1. תיקון קטגוריות "nan" -> "General"
    print("🔧 מתקן קטגוריות ריקות...")
    cursor.execute("""
        UPDATE transactions 
        SET category = 'General' 
        WHERE category = 'nan' OR category IS NULL OR category = ''
    """)

    # 2. תיקון תיאורים וספקים "nan" -> ריק
    print("🔧 מנקה תיאורים וספקים...")
    cursor.execute("""
        UPDATE transactions 
        SET description = '' 
        WHERE description = 'nan'
    """)
    cursor.execute("""
        UPDATE transactions 
        SET supplier = '' 
        WHERE supplier = 'nan'
    """)

    # 3. מחיקת שורות זבל (ללא פרויקט או ללא סכום תקין)
    # אלו בד"כ שורות בדיקה ישנות
    print("🗑️ מוחק שורות זבל ישנות...")
    cursor.execute("DELETE FROM transactions WHERE project_id IS NULL")
    cursor.execute("DELETE FROM transactions WHERE type IS NULL")

    # 4. וידוא שכל הפרויקטים מקבלים תקציב דיפולטיבי (למקרה שפספסנו)
    print("💰 מרענן תקציבים...")
    # שליפת כל הפרויקטים
    cursor.execute("SELECT id FROM projects")
    projects = cursor.fetchall()
    
    # בדיקה לכל פרויקט אם יש לו תקציב
    for row in projects:
        p_id = row[0]
        cursor.execute("SELECT count(*) FROM budget_categories WHERE project_id = ?", (p_id,))
        if cursor.fetchone()[0] == 0:
            # אם אין תקציב - ניצור לו
            default_categories = [
                ("Buying", 500000), ("License", 50000), ("Realtor", 50000),
                ("Law", 50000), ("Buy Tax", 50000), ("Notary", 50000),
                ("Construction", 2000000), ("Materials", 100000), 
                ("Architect", 100000), ("Unforeseen", 50000), ("General", 100000)
            ]
            for cat, amount in default_categories:
                cursor.execute("INSERT INTO budget_categories (project_id, category_name, planned_amount) VALUES (?, ?, ?)", (p_id, cat, amount))

    conn.commit()
    
    # בדיקה כמה שורות תקינות נשארו
    cursor.execute("SELECT count(*) FROM transactions")
    final_count = cursor.fetchone()[0]
    
    conn.close()
    print(f"✨ הניקוי הושלם! יש כרגע {final_count} תנועות תקינות במערכת.")

if __name__ == "__main__":
    clean_database()