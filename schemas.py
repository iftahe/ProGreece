from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from datetime import date as date_type
from decimal import Decimal

# --------------------------
# Account Schemas
# --------------------------
class AccountBase(BaseModel):
    name: str # AcciuntNm
    account_type_id: Optional[int] = None
    remarks: Optional[str] = None
    is_system_account: Optional[int] = 0

class AccountCreate(AccountBase):
    pass

class Account(AccountBase):
    id: int

    class Config:
        from_attributes = True

# --------------------------
# Project Schemas
# --------------------------
class ProjectBase(BaseModel):
    name: str # Project name
    project_account_val: Optional[Decimal] = None
    property_cost: Optional[Decimal] = None
    status: Optional[str] = None
    remarks: Optional[str] = None
    account_balance: Optional[Decimal] = None
    total_budget: Optional[Decimal] = None

class ProjectCreate(ProjectBase):
    pass

class Project(ProjectBase):
    id: int

    class Config:
        from_attributes = True

# --------------------------
# Budget Category Schemas
# --------------------------
class BudgetCategoryBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    name: str
    project_id: Optional[int] = None
    parent_id: Optional[int] = None
    amount: Optional[Decimal] = 0
    date: Optional[date_type] = None

class BudgetCategoryCreate(BudgetCategoryBase):
    pass

class BudgetCategoryUpdate(BaseModel):
    amount: Optional[Decimal] = None

class BudgetCategory(BudgetCategoryBase):
    id: int

    class Config:
        from_attributes = True

# --------------------------
# Transaction Schemas
# --------------------------
class TransactionBase(BaseModel):
    date: Optional[datetime] = None
    project_id: Optional[int] = None
    phase_id: Optional[int] = None
    from_account_id: Optional[int] = None
    to_account_id: Optional[int] = None
    amount: Optional[Decimal] = None
    vat_rate: Optional[Decimal] = None
    withholding_rate: Optional[Decimal] = None
    remarks: Optional[str] = None
    transaction_type: Optional[int] = None
    cust_invoice: Optional[str] = None
    cust_id: Optional[int] = None
    budget_item_id: Optional[int] = None

class TransactionCreate(TransactionBase):
    pass

class Transaction(TransactionBase):
    id: int

    class Config:
        from_attributes = True
