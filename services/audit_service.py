import json
from datetime import datetime
from decimal import Decimal


def decimal_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def log_audit(db, entity_type: str, entity_id: int, action: str, old_data: dict = None, new_data: dict = None):
    """Write an audit log entry to the audit_log table."""
    from models import AuditLog

    # Build diff payload to store in diff_json (the actual column in AuditLog model)
    diff_payload = {}
    if old_data is not None:
        diff_payload["old"] = old_data
    if new_data is not None:
        diff_payload["new"] = new_data

    entry = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        diff_json=json.dumps(diff_payload, default=decimal_default) if diff_payload else None,
        timestamp=datetime.utcnow(),
    )
    db.add(entry)
    db.commit()
