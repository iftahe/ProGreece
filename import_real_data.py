
import pandas as pd
from sqlalchemy.orm import Session
from datetime import datetime
from decimal import Decimal
import logging

from database import SessionLocal, engine
import models

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Constants for Column Mapping
COL_FROM = 'מ'
COL_TO = 'אל'
COL_AMOUNT = 'ערך'
COL_VAT = 'מעמ'
COL_DATE = 'תאריך' # Found exactly as 'תאריך' in logs

# Constants for Logic
SYSTEM_KEYWORDS = ["פרוגריס", "Progreece", "מעמ", "VAT", "מס", "Withholding", "בנק", "Bank"] # added 'Bank' as potential system/middle
TYPE_CUSTOMER_ID = 1
TYPE_SUPPLIER_ID = 2
TYPE_SYSTEM_ID = 3

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_or_create_account(db: Session, account_name: str, cache: dict) -> models.Account:
    """
    Finds or creates an account based on the name.
    Uses keywords to determine AccountType (System vs Other).
    """
    if not isinstance(account_name, str):
        account_name = str(account_name)
    
    account_name = account_name.strip()
    
    if account_name in cache:
        return cache[account_name]

    # Check DB
    account = db.query(models.Account).filter(models.Account.name == account_name).first()
    
    if not account:
        # Determine Type
        acc_type_id = TYPE_SUPPLIER_ID # Default
        
        # Check for System keywords
        if any(keyword.lower() in account_name.lower() for keyword in SYSTEM_KEYWORDS):
            acc_type_id = TYPE_SYSTEM_ID
        
        # Create
        logger.info(f"Creating new account: {account_name} (Type ID: {acc_type_id})")
        account = models.Account(name=account_name, account_type_id=acc_type_id)
        db.add(account)
        db.commit()
        db.refresh(account)
    
    cache[account_name] = account
    return account

def parse_amount(val):
    if pd.isna(val) or val == '':
        return 0.0
    
    # Remove commas and currency symbols if present
    if isinstance(val, str):
        clean_val = val.replace(',', '').replace('₪', '').replace('$', '').strip()
        try:
            return float(clean_val)
        except:
            return 0.0
    try:
        return float(val)
    except:
        return 0.0

def parse_vat_rate(val):
    if pd.isna(val) or val == '':
        return 0.0
    
    # Handle percentage strings like "10%", "0.17"
    if isinstance(val, str):
        clean_val = val.replace('%', '').strip()
        try:
            parsed = float(clean_val)
            # If > 1, assume it's like "17" for 17% -> 0.17
            # If < 1, assume it's "0.17"
            if parsed > 1:
                return parsed / 100.0
            return parsed
        except:
            return 0.0
    try:
        return float(val)
    except:
        return 0.0

def import_data():
    db = SessionLocal()
    
    # 1. Load Data
    original_path = "c:/Users/iftahe/Greece Project/Progreece21 - Sheet2.csv"
    temp_path = "c:/Users/iftahe/Greece Project/temp_import.xlsx"
    
    df = None
    try:
        # Check for Excel Signature (PK..)
        with open(original_path, 'rb') as f:
            header = f.read(2)
        
        if header == b'PK':
            logger.info("Detected Excel/ZIP signature. Copying to temp .xlsx...")
            import shutil
            import os
            shutil.copyfile(original_path, temp_path)
            
            logger.info("Reading Excel file...")
            # Using header=1 because previous attempt showed Unnamed columns, implying row 0 is junk
            df = pd.read_excel(temp_path, engine='openpyxl', header=1)
            
            # Cleanup
            if os.path.exists(temp_path):
                os.remove(temp_path)
        else:
            # Try utf-8-sig first
            try:
                df = pd.read_csv(original_path, encoding='utf-8-sig')
            except UnicodeDecodeError:
                logger.warning("UTF-8-SIG failed, trying cp1255 (Hebrew Windows)...")
                df = pd.read_csv(original_path, encoding='cp1255')
                
    except Exception as e:
        logger.error(f"Failed to read file: {e}")
        # Cleanup fallback
        import os
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass
        return

    logger.info(f"Loaded Data with {len(df)} rows.")
    logger.info(f"Columns found: {df.columns.tolist()}")

    # 2. Get/Create Default Project
    project = db.query(models.Project).first()
    if not project:
        logger.info("No project found. Creating 'Imported Project'.")
        project = models.Project(name="Imported Project", status="Active", property_cost=0)
        db.add(project)
        db.commit()
        db.refresh(project)
    
    logger.info(f"Using Project: {project.name} (ID: {project.id})")

    # 3. Account Cache
    account_cache = {}
    
    # 4. Iterate and Insert
    success_count = 0
    skip_count = 0

    # Ensure required columns exist
    missing_cols = [c for c in [COL_FROM, COL_TO, COL_AMOUNT] if c not in df.columns]
    
    # Strip whitespace from columns
    original_cols = df.columns.tolist()
    df.columns = [str(c).strip() for c in df.columns]

    # Fuzzy Date Column Detection
    date_col = None
    
    # Check exact match first (after stripping from previous step)
    if COL_DATE in df.columns:
        date_col = COL_DATE
    else:
        # Check for substring match
        candidates = []
        for c in df.columns:
            # Check for 'date' (english) or Hebrew 'תאריך'
            # We explicitly check for the Hebrew characters to avoid encoding string diffs
            if 'date' in str(c).lower() or 'תאריך' in str(c) or \
               ('\u05ea' in str(c) and '\u05d0' in str(c)): # heuristic for partial hebrew match
                candidates.append(c)
        
        if candidates:
            date_col = candidates[0]
            logger.info(f"Date column inferred as: {date_col}")
        else:
            # Fallback to Index 0
            if len(df.columns) > 0:
                date_col = df.columns[0]
                logger.warning(f"Date column detection failed. Defaulting to first column: {date_col}")
            else:
                logger.error("No columns in dataframe.")
                return

    if not date_col:
            logger.error(f"Could not find a Date column.")
            logger.info(f"Expected: '{COL_DATE}'")
            logger.info(f"Found Columns: {df.columns.tolist()}")
            logger.info(f"Original Columns: {original_cols}")
            
            # Simple HEX Dump of columns to see encoding
            for c in df.columns:
                 logger.info(f"Col: {c} -> {[hex(ord(x)) for x in str(c)]}")

            # Cleanup
            import os
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except:
                    pass
            
            return

    if missing_cols:
        logger.error(f"Missing required columns: {missing_cols}")
        logger.info("Please rename columns in CSV or update script mapping.")
        return

    for index, row in df.iterrows():
        try:
            # Skip empty rows (no amount)
            raw_amount = row.get(COL_AMOUNT)
            if pd.isna(raw_amount) or raw_amount == '':
                skip_count += 1
                continue

            # Parse Fields
            amount = parse_amount(raw_amount)
            vat_rate = parse_vat_rate(row.get(COL_VAT, 0))
            
            from_name = row.get(COL_FROM)
            to_name = row.get(COL_TO)
            
            if pd.isna(from_name) or pd.isna(to_name):
                logger.warning(f"Row {index}: Missing 'From' or 'To' account. Skipping.")
                skip_count += 1
                continue

            # Resolve Accounts
            from_acc = get_or_create_account(db, from_name, account_cache)
            to_acc = get_or_create_account(db, to_name, account_cache)
            
            # DEBUG
            if not from_acc.id or not to_acc.id or not project.id:
                 logger.error(f"Row {index}: Missing IDs. Project: {project.id}, From: {from_acc.id}, To: {to_acc.id}")

            # Parse Date
            try:
                dt_obj = pd.to_datetime(row[date_col], dayfirst=True)
                if pd.isna(dt_obj):
                     date_val = datetime.now()
                     logger.warning(f"Row {index}: Date is NaT/Null, using today.")
                else:
                     date_val = dt_obj.to_pydatetime()
            except:
                date_val = datetime.now()
                logger.warning(f"Row {index}: Failed to parse date '{row[date_col]}', using today.")

            # Create Transaction
            transaction = models.Transaction(
                date=date_val,
                amount=amount,
                vat_rate=vat_rate,
                project_id=int(project.id),
                from_account_id=int(from_acc.id),
                to_account_id=int(to_acc.id),
                remarks=f"Imported from CSV - Row {index}",
                transaction_type=1 
            )
            
            try:
                db.add(transaction)
                # Flush to detect error immediately per row (slower but safer for debug)
                db.flush() 
                success_count += 1
            except Exception as insert_err:
                import traceback
                logger.error(f"Row {index}: Insert Failed.")
                logger.error(f"Data: Amount={amount} (type {type(amount)}), Date={date_val} (type {type(date_val)})")
                logger.error(f"Error: {insert_err}")
                logger.error(traceback.format_exc())
                db.rollback()
                skip_count += 1
                continue
            
            if success_count % 50 == 0:
                print(f"Imported {success_count} transactions...", end='\r')

        except Exception as e:
            logger.error(f"Row {index}: Unexpected Error - {e}")
            skip_count += 1

    try:
        db.commit()
    except Exception as commit_err:
         logger.error(f"Commit Failed: {commit_err}")
         
    print(f"\nImport Complete! Success: {success_count}, Skipped: {skip_count}")
    db.close()

if __name__ == "__main__":
    import_data()
