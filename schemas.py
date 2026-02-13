from pydantic import BaseModel, validator
from datetime import date, datetime
from typing import Optional, List
from decimal import Decimal
from enum import Enum

# --- Account Schemas ---
class AccountType(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

class AccountBase(BaseModel):
    name: str
    account_type_id: Optional[int] = None
    remarks: Optional[str] = None
    is_system_account: Optional[int] = 0

class Account(AccountBase):
    id: int
    class Config:
        from_attributes = True

# --- Project Schemas ---
class ProjectBase(BaseModel):
    name: str
    status: Optional[str] = "Active"
    project_account_val: Optional[float] = 0
    property_cost: Optional[float] = None
    remarks: Optional[str] = None
    account_balance: Optional[float] = 0
    total_budget: Optional[float] = None

class ProjectCreate(ProjectBase):
    pass

class Project(ProjectBase):
    id: int
    class Config:
        from_attributes = True

# --- Transaction Schemas ---
class TransactionBase(BaseModel):
    date: datetime
    amount: float
    project_id: Optional[int] = None
    phase_id: Optional[int] = None
    from_account_id: Optional[int] = None
    to_account_id: Optional[int] = None
    vat_rate: Optional[float] = 0
    withholding_rate: Optional[float] = 0
    remarks: Optional[str] = None
    transaction_type: Optional[int] = 1  # 1=Executed, 2=Planned
    cust_invoice: Optional[str] = None
    cust_id: Optional[int] = None
    budget_item_id: Optional[int] = None
    # Legacy fields
    category: Optional[str] = None
    description: Optional[str] = None
    supplier: Optional[str] = None
    type: Optional[str] = None

class TransactionCreate(TransactionBase):
    pass

class Transaction(TransactionBase):
    id: int
    class Config:
        from_attributes = True

# --- Budget Schemas ---
class BudgetCategoryBase(BaseModel):
    category_name: str
    planned_amount: float

class BudgetCategoryCreate(BudgetCategoryBase):
    project_id: int

class BudgetCategory(BudgetCategoryBase):
    id: int
    project_id: int
    class Config:
        from_attributes = True


# --- Payment Method Enum ---
class PaymentMethodEnum(str, Enum):
    BANK_TRANSFER = "Bank Transfer"
    TRUST_ACCOUNT = "Trust Account"
    CASH = "Cash"
    DIRECT_TO_OWNER = "Direct to Owner"


# --- Apartment Schemas ---
class ApartmentBase(BaseModel):
    name: str
    floor: Optional[str] = None
    apartment_number: Optional[str] = None
    customer_name: Optional[str] = None
    customer_key: Optional[int] = None
    sale_price: Optional[float] = None
    ownership_percent: Optional[float] = None
    remarks: Optional[str] = None

class ApartmentCreate(ApartmentBase):
    pass

class Apartment(ApartmentBase):
    id: int
    project_id: int
    total_paid: Optional[float] = 0
    remaining: Optional[float] = None
    class Config:
        from_attributes = True


# --- Customer Payment Schemas ---
class CustomerPaymentBase(BaseModel):
    date: datetime
    amount: float
    payment_method: PaymentMethodEnum = PaymentMethodEnum.BANK_TRANSFER
    notes: Optional[str] = None

class CustomerPaymentCreate(CustomerPaymentBase):
    pass

class CustomerPayment(CustomerPaymentBase):
    id: int
    apartment_id: int
    class Config:
        from_attributes = True


# --- Budget Plan Schemas ---
class BudgetPlanBase(BaseModel):
    planned_date: datetime
    amount: float
    description: Optional[str] = None

class BudgetPlanCreate(BudgetPlanBase):
    pass

class BudgetPlan(BudgetPlanBase):
    id: int
    budget_category_id: int
    class Config:
        from_attributes = True