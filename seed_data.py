from database import SessionLocal, engine
import models
from datetime import datetime, timedelta
from decimal import Decimal

# Create tables if not exist
models.Base.metadata.create_all(bind=engine)

def seed():
    db = SessionLocal()
    
    # 1. Check if data exists
    if db.query(models.Project).first():
        print("Database already contains data. Skipping seed.")
        return

    print("Seeding data...")

    # 2. Create Account Types
    type_customer = models.AccountType(name="Customer") # ID 1
    type_supplier = models.AccountType(name="Supplier") # ID 2
    type_system = models.AccountType(name="System/Middle") # ID 3
    db.add_all([type_customer, type_supplier, type_system])
    db.commit()

    # 3. Create Accounts
    # System Accounts
    acc_bank_il = models.Account(name="Bank Leumi IL", account_type=type_system)
    acc_vat = models.Account(name="VAT Authority", account_type=type_system)
    
    # Customers
    acc_investor_1 = models.Account(name="Yossi Cohen (Investor)", account_type=type_customer)
    
    # Suppliers
    acc_contractor = models.Account(name="BuildIt Ltd", account_type=type_supplier)
    
    db.add_all([acc_bank_il, acc_vat, acc_investor_1, acc_contractor])
    db.commit()

    # 4. Create Project
    proj_alpha = models.Project(
        name="Athens Luxury 1", 
        status="Active", 
        project_account_val=0,
        property_cost=500000
    )
    db.add(proj_alpha)
    db.commit()

    # 4.5. Create Budget Categories with Phase Hierarchy
    # Phase: Buying
    buying_phase = models.BudgetCategory(
        name="Buying",
        project_id=proj_alpha.id,
        parent_id=None,  # Top-level phase
        amount=Decimal(500000),
        date=datetime.now() + timedelta(days=30)
    )
    db.add(buying_phase)
    db.flush()  # Get the ID
    
    # Buying phase children
    license_cat = models.BudgetCategory(
        name="License",
        project_id=proj_alpha.id,
        parent_id=buying_phase.id,
        amount=Decimal(150000),
        date=datetime.now() + timedelta(days=60)
    )
    realtor_cat = models.BudgetCategory(
        name="Realtor",
        project_id=proj_alpha.id,
        parent_id=buying_phase.id,
        amount=Decimal(90520),
        date=datetime.now() + timedelta(days=45)
    )
    law_cat = models.BudgetCategory(
        name="Law",
        project_id=proj_alpha.id,
        parent_id=buying_phase.id,
        amount=Decimal(48260),
        date=datetime.now() + timedelta(days=15)
    )
    buy_tax_cat = models.BudgetCategory(
        name="Buy Tax",
        project_id=proj_alpha.id,
        parent_id=buying_phase.id,
        amount=Decimal(106000),
        date=datetime.now() + timedelta(days=20)
    )
    notary_cat = models.BudgetCategory(
        name="Notary",
        project_id=proj_alpha.id,
        parent_id=buying_phase.id,
        amount=Decimal(98580),
        date=datetime.now() + timedelta(days=25)
    )
    
    # Phase: Construction
    construction_phase = models.BudgetCategory(
        name="Construction",
        project_id=proj_alpha.id,
        parent_id=None,  # Top-level phase
        amount=Decimal(2000000),
        date=datetime.now() + timedelta(days=90)
    )
    db.add(construction_phase)
    db.flush()  # Get the ID
    
    # Construction phase children
    construction_cat = models.BudgetCategory(
        name="Construction",
        project_id=proj_alpha.id,
        parent_id=construction_phase.id,
        amount=Decimal(6264480),
        date=datetime.now() + timedelta(days=120)
    )
    materials_cat = models.BudgetCategory(
        name="Materials",
        project_id=proj_alpha.id,
        parent_id=construction_phase.id,
        amount=Decimal(800000),
        date=datetime.now() + timedelta(days=100)
    )
    architect_cat = models.BudgetCategory(
        name="Architect",
        project_id=proj_alpha.id,
        parent_id=construction_phase.id,
        amount=Decimal(150000),
        date=datetime.now() + timedelta(days=80)
    )
    
    db.add_all([
        license_cat, realtor_cat, law_cat, buy_tax_cat, notary_cat,
        construction_cat, materials_cat, architect_cat
    ])
    db.commit()
    print("Budget categories created with phase hierarchy.")

    # 5. Create Transactions (HISTORY)
    # Income: Investor pays 100,000
    t1 = models.Transaction(
        date=datetime.now() - timedelta(days=60),
        project_id=proj_alpha.id,
        from_account_id=acc_investor_1.id,
        to_account_id=acc_bank_il.id, # Income
        amount=Decimal(100000),
        remarks="First Installment",
        transaction_type=1
    )
    
    # Expense: Paying Contractor 20,000
    t2 = models.Transaction(
        date=datetime.now() - timedelta(days=30),
        project_id=proj_alpha.id,
        from_account_id=acc_bank_il.id,
        to_account_id=acc_contractor.id, # Expense
        amount=Decimal(20000),
        remarks="Foundation works",
        transaction_type=2
    )

    db.add_all([t1, t2])
    db.commit()

    # 6. Create Future Plan (FORECAST)
    # Investor supposed to pay 50,000 yesterday (Late!) -> Should Roll Over
    plan1 = models.CustomerPaymentPlan(
        project_id=proj_alpha.id,
        price_id=None, # Simplifying for seed
        manual_date=datetime.now() - timedelta(days=1),
        value=Decimal(50000),
        remarks="Second Installment (Late)"
    )
    
    # Investor pays next month 50,000
    plan2 = models.CustomerPaymentPlan(
        project_id=proj_alpha.id,
        price_id=None,
        manual_date=datetime.now() + timedelta(days=30),
        value=Decimal(50000),
        remarks="Third Installment"
    )

    db.add_all([plan1, plan2])
    db.commit()
    
    print("Seeding Complete! Restart the Backend.")
    db.close()

if __name__ == "__main__":
    seed()