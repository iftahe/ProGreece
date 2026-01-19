from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric, Text, Date
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime

Base = declarative_base()

# --------------------------
# Lookup Tables
# --------------------------

class AccountType(Base):
    __tablename__ = 'account_types'
    
    # Original: [AccountType]
    id = Column(Integer, primary_key=True, index=True) # Original: AccountType
    name = Column(String(255)) # Original: AccountTypeNm

    # Relationships
    accounts = relationship("Account", back_populates="account_type")


class Category(Base):
    __tablename__ = 'categories'
    
    # Original: [Category]
    id = Column(Integer, primary_key=True, index=True) # Original: Category
    name = Column(String(255)) # Original: CategoryName
    order = Column(Numeric(10, 2)) # Original: Category order
    category_group = Column(String(255)) # Original: Category2


# --------------------------
# Core Entities
# --------------------------

class Account(Base):
    __tablename__ = 'accounts'

    # Original: [Accounts]
    id = Column(Integer, primary_key=True, index=True) # Original: ID
    name = Column(String(255)) # Original: AcciuntNm
    account_type_id = Column(Integer, ForeignKey('account_types.id'), nullable=True) # Original: AccountType
    remarks = Column(Text, nullable=True) # Original: Remarks
    is_system_account = Column(Integer, default=0) # Original: SysAccount

    # Relationships
    account_type = relationship("AccountType", back_populates="accounts")
    transactions_from = relationship("Transaction", foreign_keys="[Transaction.from_account_id]", back_populates="from_account")
    transactions_to = relationship("Transaction", foreign_keys="[Transaction.to_account_id]", back_populates="to_account")


class Project(Base):
    __tablename__ = 'projects'

    # Original: [Projects]
    id = Column(Integer, primary_key=True, index=True) # Original: ID
    name = Column(String(255), unique=True, index=True) # Original: Project name
    project_account_val = Column(Numeric(18, 2), nullable=True) # Original: Project account
    property_cost = Column(Numeric(18, 2), nullable=True) # Original: Property cost
    status = Column(String(255), nullable=True) # Original: Statuse
    remarks = Column(Text, nullable=True) # Original: Remarks
    account_balance = Column(Numeric(18, 2), nullable=True) # Original: AccountBalance
    total_budget = Column(Numeric(18, 2), nullable=True)

    # Relationships
    transactions = relationship("Transaction", back_populates="project")
    apartment_prices = relationship("ApartmentPrice", back_populates="project")
    payment_phases = relationship("ProjectPaymentPhase", back_populates="project")
    budget_categories = relationship("BudgetCategory", back_populates="project")

class BudgetCategory(Base):
    __tablename__ = 'budget_categories'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'))
    name = Column(String(255))
    parent_id = Column(Integer, ForeignKey('budget_categories.id'), nullable=True)
    amount = Column(Numeric(18, 2), default=0)
    date = Column(Date, nullable=True)

    project = relationship("Project", back_populates="budget_categories")
    parent = relationship("BudgetCategory", remote_side=[id], back_populates="children")
    children = relationship("BudgetCategory", back_populates="parent")
    transactions = relationship("Transaction", back_populates="budget_item")


# --------------------------
# Operational Data (Transactions)
# --------------------------

class Transaction(Base):
    __tablename__ = 'transactions'

    # Original: [Transactions]
    id = Column(Integer, primary_key=True, index=True) # Original: ID
    date = Column(DateTime, nullable=True) # Original: Date
    project_id = Column(Integer, ForeignKey('projects.id'), nullable=True) # Original: Project
    phase_id = Column(Integer, nullable=True) # Original: Phaze (Likely FK to ProjectPaymentPhase, but kept integer for safety as per legacy)
    from_account_id = Column(Integer, ForeignKey('accounts.id'), nullable=True) # Original: from
    to_account_id = Column(Integer, ForeignKey('accounts.id'), nullable=True) # Original: to
    amount = Column(Numeric(18, 2), nullable=True) # Original: Amount
    vat_rate = Column(Numeric(10, 4), nullable=True) # Original: VAT (Percentage)
    withholding_rate = Column(Numeric(10, 4), nullable=True) # Original: Withholding (Percentage)
    remarks = Column(String(255), nullable=True) # Original: Remarks
    transaction_type = Column(Integer, nullable=True) # Original: TransType
    cust_invoice = Column(String(255), nullable=True) # Original: CustInvoice
    cust_id = Column(Integer, nullable=True) # Original: CustID
    budget_item_id = Column(Integer, ForeignKey('budget_categories.id'), nullable=True)

    # Relationships
    project = relationship("Project", back_populates="transactions")
    from_account = relationship("Account", foreign_keys=[from_account_id], back_populates="transactions_from")
    to_account = relationship("Account", foreign_keys=[to_account_id], back_populates="transactions_to")
    budget_item = relationship("BudgetCategory", back_populates="transactions")


# --------------------------
# Forecast & Planning (Critical for Cash Flow)
# --------------------------

class ProjectPaymentPhase(Base):
    __tablename__ = 'project_payment_phases'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'))
    
    # שינינו את השמות כדי שיתאימו לסקריפט ויהיו ברורים יותר
    name = Column(String(255))          # במקום phase_name
    amount = Column(Numeric(10, 2))     # הוספנו סכום! (חשוב מאוד)
    target_date = Column(DateTime, nullable=True) # במקום date
    status = Column(String(50), default="Pending") # הוספנו סטטוס
    
    # שמרנו גם את השדות הישנים למקרה הצורך, אבל כרגע הם לא בשימוש
    remarks = Column(Text, nullable=True)

    project = relationship("Project", back_populates="payment_phases")


class ApartmentPrice(Base):
    __tablename__ = 'apartment_prices'

    # Original: [Appartment price]
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id')) # Original: Project
    customer_account_id = Column(Integer, ForeignKey('accounts.id')) # Original: Customer
    floor = Column(String(255), nullable=True)
    apartment = Column(String(255), nullable=True)
    price = Column(Numeric(18, 2), nullable=True)
    percent = Column(Numeric(18, 6), nullable=True)
    remarks = Column(Text, nullable=True)

    project = relationship("Project", back_populates="apartment_prices")
    payment_plans = relationship("CustomerPaymentPlan", back_populates="apartment_price")


class CustomerPaymentPlan(Base):
    __tablename__ = 'customer_payment_plans'

    # Original: [Customers payment plan]
    # This is the table that drives the "Planned" part of the Cash Flow
    id = Column(Integer, primary_key=True, index=True)
    price_id = Column(Integer, ForeignKey('apartment_prices.id')) # Original: PriceID
    phase_id = Column(Integer, nullable=True) # Original: Phaze (FK to ProjectPaymentPhase)
    manual_date = Column(DateTime, nullable=True) # Original: Manual date
    value = Column(Numeric(18, 2), nullable=True) # Original: Value
    remarks = Column(Text, nullable=True)
    project_id = Column(Integer, nullable=True) # Added for optimization, exists in legacy

    apartment_price = relationship("ApartmentPrice", back_populates="payment_plans")
    