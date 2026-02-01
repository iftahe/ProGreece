"""
inspect_data_issues.py
Diagnostic script to investigate two reported import issues:
1. Missing row: amount ~93, date 30/5/24
2. Wrong classification: amount 28455, date 20/11/23
"""
import pandas as pd

FILE = 'progreeace 34 - תנועות בפועל.csv'

# --- Load CSV ---
try:
    df = pd.read_csv(FILE, encoding='utf-8-sig')
except Exception:
    df = pd.read_csv(FILE, encoding='cp1255')

print("=" * 60)
print("1. COLUMN LIST")
print("=" * 60)
for i, col in enumerate(df.columns):
    print(f"  [{i}] '{col}'")

print(f"\nTotal rows: {len(df)}")

# --- Issue 1: amount ~93, date contains "30" and "5" ---
print("\n" + "=" * 60)
print("2. ISSUE #1 - Looking for amount ~93 near date 30/5")
print("=" * 60)

for idx, row in df.iterrows():
    amount = row.get('Amount', None)
    date_str = str(row.get('Date', ''))
    try:
        amt = float(amount)
    except (ValueError, TypeError):
        continue
    if 90 <= amt <= 95:
        print(f"\n  >>> ROW {idx} (CSV line {idx + 2}):")
        for col in df.columns:
            print(f"      {col:20s} = {row[col]}")
        # Test what parse_date does with this date
        print(f"\n  --- Date parsing test ---")
        print(f"      Raw date value: '{date_str}'")
        try:
            parsed = pd.to_datetime(date_str, dayfirst=True)
            print(f"      dayfirst=True  -> {parsed}")
        except Exception as e:
            print(f"      dayfirst=True  -> FAILED: {e}")
        try:
            parsed = pd.to_datetime(date_str, dayfirst=False)
            print(f"      dayfirst=False -> {parsed}")
        except Exception as e:
            print(f"      dayfirst=False -> FAILED: {e}")

# --- Issue 2: amount 28455 ---
print("\n" + "=" * 60)
print("3. ISSUE #2 - Looking for amount 28455")
print("=" * 60)

for idx, row in df.iterrows():
    amount = row.get('Amount', None)
    try:
        amt = float(amount)
    except (ValueError, TypeError):
        continue
    if 28450 <= amt <= 28460:
        print(f"\n  >>> ROW {idx} (CSV line {idx + 2}):")
        for col in df.columns:
            print(f"      {col:20s} = {row[col]}")
        # Show the from/to to understand direction
        print(f"\n  --- Direction analysis ---")
        from_acc = row.get('from', '')
        to_acc = row.get('to', '')
        print(f"      from: '{from_acc}'")
        print(f"      to:   '{to_acc}'")
        print(f"      NOTE: import_real_data.py hardcodes type='expense' for ALL rows (line 96)")
        if 'Trust' in str(to_acc) or 'incom' in str(to_acc):
            print(f"      ==> This looks like INCOME (customer paying into trust/company)")
