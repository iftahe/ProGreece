import sqlite3
from database import get_db_connection
from collections import defaultdict

def normalize_string(s):
    """Normalize string for case-insensitive comparison"""
    if s is None:
        return ""
    return str(s).strip().lower()

def get_budget_report(project_id):
    """
    מחזיר את דוח התקציב: משווה בין התקציב המתוכנן (budget_categories)
    לבין ההוצאות בפועל (transactions).
    מבצע התאמה case-insensitive בין קטגוריות.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. שליפת כל קטגוריות התקציב לפרויקט
    cursor.execute("""
        SELECT id, category_name, planned_amount
        FROM budget_categories
        WHERE project_id = ?
    """, (project_id,))
    budget_rows = cursor.fetchall()

    # 2. שליפת סיכום הוצאות בפועל לפי קטגוריה
    # Check both 'type' field (legacy) and 'transaction_type' field
    # transaction_type = 1 means Executed, and we want expenses
    cursor.execute("""
        SELECT 
            budget_item_id,
            category, 
            SUM(amount) as total_actual
        FROM transactions
        WHERE project_id = ? 
          AND (
            type = 'expense' 
            OR transaction_type = 1
          )
        GROUP BY budget_item_id, category
    """, (project_id,))
    actual_rows = cursor.fetchall()

    conn.close()

    # Create maps for matching:
    # 1. By budget_item_id (most accurate)
    # 2. By normalized category name (case-insensitive fallback)
    actual_by_budget_id = defaultdict(float)
    actual_by_category = defaultdict(float)
    
    for row in actual_rows:
        amount = float(row['total_actual'] or 0)
        budget_item_id = row['budget_item_id']
        category = row['category']
        
        # Match by budget_item_id if available (most accurate)
        if budget_item_id:
            actual_by_budget_id[budget_item_id] += amount
        
        # Also index by normalized category name for fallback matching
        if category:
            normalized_category = normalize_string(category)
            actual_by_category[normalized_category] += amount

    report = []
    total_planned = 0
    total_actual = 0

    for item in budget_rows:
        budget_id = item['id']
        cat_name = item['category_name']
        planned = float(item['planned_amount'] or 0)
        
        # First try to match by budget_item_id (most accurate)
        actual = actual_by_budget_id.get(budget_id, 0)
        
        # If no match by ID, fall back to case-insensitive category name matching
        if actual == 0:
            normalized_budget_cat = normalize_string(cat_name)
            actual = actual_by_category.get(normalized_budget_cat, 0)
        
        variance = planned - actual
        progress = (actual / planned * 100) if planned > 0 else 0

        total_planned += planned
        total_actual += actual

        report.append({
            "id": item['id'],
            "name": cat_name,  # Changed from "category" to "name" to match frontend
            "planned": planned,
            "actual": actual,
            "variance": variance,
            "progress": round(progress, 2),
            "is_parent": False  # Add is_parent field for frontend compatibility
        })

    # Only return report items (frontend expects array, not dict with items/summary)
    # The frontend iterates over reportData directly
    return report

def update_budget_item(item_id, new_amount):
    """עדכון סכום מתוכנן לקטגוריה"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE budget_categories
        SET planned_amount = ?
        WHERE id = ?
    """, (new_amount, item_id))
    conn.commit()
    conn.close()
    return True

def initialize_project_budget(project_id):
    """
    יוצר קטגוריות תקציב דיפולטיביות לפרויקט חדש אם עדיין אין לו.
    """
    default_categories = [
        ("Buying", 500000),
        ("License", 50000),
        ("Realtor", 50000),
        ("Law", 50000),
        ("Buy Tax", 50000),
        ("Notary", 50000),
        ("Construction", 2000000),
        ("Materials", 100000),
        ("Architect", 100000),
        ("Unforeseen", 50000)
    ]

    conn = get_db_connection()
    cursor = conn.cursor()

    # בדיקה אם כבר יש קטגוריות
    cursor.execute("SELECT COUNT(*) FROM budget_categories WHERE project_id = ?", (project_id,))
    count = cursor.fetchone()[0]

    if count == 0:
        print(f"Creating default budget for project {project_id}...")
        for cat_name, default_amount in default_categories:
            cursor.execute("""
                INSERT INTO budget_categories (project_id, category_name, planned_amount)
                VALUES (?, ?, ?)
            """, (project_id, cat_name, default_amount))
        conn.commit()
    
    conn.close()