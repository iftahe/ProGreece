from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Numeric, Text
from sqlalchemy.orm import relationship
from database import Base

class AccountType(Base):
    __tablename__ = "account_types"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255))

class Account(Base):
    __tablename__ = "accounts"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255))
    account_type_id = Column(Integer, ForeignKey("account_types.id"))
    remarks = Column(Text)
    is_system_account = Column(Integer, default=0)

    account_type = relationship("AccountType")

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True)
    status = Column(String(255))
    project_account_val = Column(Numeric(18, 2), default=0)
    property_cost = Column(Numeric(18, 2))
    remarks = Column(Text)
    account_balance = Column(Numeric(18, 2), default=0)
    total_budget = Column(Numeric(18, 2))

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    date = Column(DateTime)
    phase_id = Column(Integer)
    from_account_id = Column(Integer, ForeignKey("accounts.id"))
    to_account_id = Column(Integer, ForeignKey("accounts.id"))
    amount = Column(Numeric(18, 2))
    vat_rate = Column(Numeric(10, 4))
    withholding_rate = Column(Numeric(10, 4))
    remarks = Column(String(255))
    transaction_type = Column(Integer)  # 1=Executed, 2=Planned
    cust_invoice = Column(String(255))
    cust_id = Column(Integer)
    budget_item_id = Column(Integer, ForeignKey("budget_categories.id"))
    # Legacy fields (kept for compatibility)
    category = Column(Text)
    description = Column(Text)
    supplier = Column(Text)
    type = Column(Text)  # expense / income

    project = relationship("Project")
    from_account = relationship("Account", foreign_keys=[from_account_id])
    to_account = relationship("Account", foreign_keys=[to_account_id])

class BudgetCategory(Base):
    __tablename__ = "budget_categories"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    category_name = Column(Text)
    planned_amount = Column(Float)

    project = relationship("Project")

class CustomerPaymentPlan(Base):
    __tablename__ = "customer_payment_plans"
    id = Column(Integer, primary_key=True, index=True)
    price_id = Column(Integer)
    phase_id = Column(Integer)
    manual_date = Column(DateTime)
    value = Column(Numeric(18, 2))
    remarks = Column(Text)
    project_id = Column(Integer, ForeignKey("projects.id"))

    project = relationship("Project")