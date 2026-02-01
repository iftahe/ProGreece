import sqlite3

DB_NAME = 'greece_project.db'

def fix_schema():
    print("🔧 מתקן את מבנה הטבלאות (סבב אחרון ודי)...")
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # הוספת עמודת type לטבלת תנועות
    try:
        cursor.execute("ALTER TABLE transactions ADD COLUMN type TEXT")
        print("✅ עמודת 'type' נוספה לטבלת transactions.")
    except Exception:
        pass # כבר קיימת

    conn.commit()
    conn.close()
    print("✨ הדאטה-בייס מוכן סופית!")

if __name__ == "__main__":
    fix_schema()