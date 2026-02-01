import pandas as pd
import glob
import os

def check_csv_files():
    # חיפוש כל קבצי ה-CSV בתיקייה הנוכחית
    csv_files = glob.glob("*.csv")
    
    if not csv_files:
        print("❌ לא נמצאו קבצי CSV בתיקייה הנוכחית!")
        print(f"📂 התיקייה הנוכחית היא: {os.getcwd()}")
        print("💡 טיפ: ודא שהעתקת את קבצי האקסל/CSV לתיקייה הזו.")
        return

    print(f"🔎 נמצאו {len(csv_files)} קבצי CSV. בודק תוכן...\n")

    for filename in csv_files:
        print(f"📄 בודק את: {filename}")
        
        # ניסיון 1: קידוד עברי (Windows)
        try:
            df = pd.read_csv(filename, encoding='cp1255', nrows=1)
            print(f"   ✅ עמודות (cp1255): {df.columns.tolist()}")
            continue
        except:
            pass
            
        # ניסיון 2: קידוד רגיל (UTF-8)
        try:
            df = pd.read_csv(filename, encoding='utf-8', nrows=1)
            print(f"   ✅ עמודות (utf-8): {df.columns.tolist()}")
        except Exception as e:
            print(f"   ❌ נכשל בקריאה: {e}")
        
        print("-" * 40)

if __name__ == "__main__":
    check_csv_files()