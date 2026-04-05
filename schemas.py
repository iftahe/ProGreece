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
    apartment_id: Optional[int] = None
    # Legacy fields
    category: Optional[str] = None
    description: Optional[str] = None
    supplier: Optional[str] = None
    type: Optional[str] = None
    # Phase 4 fields
    vat_amount: Optional[Decimal] = None
    withholding_amount: Optional[Decimal] = None
    direction: Optional[str] = None
    status: Optional[str] = None
    counterparty_id: Optional[int] = None
    customer_id_fk: Optional[int] = None
    invoice_id: Optional[int] = None
    source_ref: Optional[str] = None
    currency: Optional[str] = "EUR"

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
    category_type: Optional[str] = None

class BudgetCategoryCreate(BudgetCategoryBase):
    project_id: int

class BudgetCategoryUpdate(BaseModel):
    category_name: Optional[str] = None
    planned_amount: Optional[float] = None

class BudgetCategory(BudgetCategoryBase):
    id: int
    project_id: int
    class Config:
        from_attributes = True

class BulkAssignBudget(BaseModel):
    transaction_ids: List[int]
    budget_category_id: int
    direction: Optional[str] = None  # 'in' or 'out'

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
    linked_transaction_ids: Optional[str] = None
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


# --- Project Setting Schemas ---
class ProjectSettingBase(BaseModel):
    cash_buffer_amount: Optional[float] = 200000

class ProjectSettingCreate(ProjectSettingBase):
    pass

class ProjectSetting(ProjectSettingBase):
    id: int
    project_id: int
    class Config:
        from_attributes = True


# --- Account Category Mapping Schemas ---
class AccountCategoryMappingBase(BaseModel):
    account_id: int
    budget_category_id: int

class AccountCategoryMapping(AccountCategoryMappingBase):
    id: int
    last_used: Optional[datetime] = None
    class Config:
        from_attributes = True


# --- Counterparty Schemas ---
class CounterpartyBase(BaseModel):
    name: str
    vat_number: Optional[str] = None
    default_category_id: Optional[int] = None

class CounterpartyCreate(CounterpartyBase):
    pass

class Counterparty(CounterpartyBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config:
        from_attributes = True


# --- Customer Schemas ---
class CustomerBase(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None

class CustomerCreate(CustomerBase):
    pass

class Customer(CustomerBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config:
        from_attributes = True


# --- Invoice Schemas ---
class InvoiceBase(BaseModel):
    project_id: int
    customer_id: Optional[int] = None
    counterparty_id: Optional[int] = None
    invoice_number: str
    invoice_date: date
    invoice_value: Decimal
    currency: Optional[str] = "EUR"
    remarks: Optional[str] = None

class InvoiceCreate(InvoiceBase):
    pass

class Invoice(InvoiceBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config:
        from_attributes = True


# --- AuditLog Schema ---
class AuditLogEntry(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    action: str
    diff_json: Optional[str] = None
    actor_user_id: Optional[int] = None
    timestamp: Optional[datetime] = None
    class Config:
        from_attributes = True