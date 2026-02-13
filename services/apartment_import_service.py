import csv
import io
from sqlalchemy.orm import Session
from decimal import Decimal
import models


def import_apartments_from_csv(db: Session, file_content: bytes):
    """
    Import apartments from uploaded CSV file content.
    Maps CSV Project names to existing Project.id via case-insensitive name matching.
    Skips empty/padding rows (ProjectKey=0 or empty Project).
    Returns {imported: N, skipped: N, unmapped_projects: [...]}.
    """
    # Build project name -> id mapping (case-insensitive)
    projects = db.query(models.Project).all()
    project_map = {p.name.lower().strip(): p.id for p in projects}

    imported = 0
    skipped = 0
    unmapped_projects = set()

    # Decode uploaded file and read as CSV
    text = file_content.decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(text))
    for row in reader:
            project_name = (row.get('Project') or '').strip()
            project_key = (row.get('ProjectKey') or '0').strip()

            # Skip empty/padding rows
            if not project_name or project_key == '0':
                skipped += 1
                continue

            # Map project name to id
            project_id = project_map.get(project_name.lower())
            if not project_id:
                unmapped_projects.add(project_name)
                skipped += 1
                continue

            # Build apartment data
            floor = (row.get('Floor') or '').strip()
            apt_num = (row.get('Appartment') or '').strip()
            name = f"Floor {floor} - Apt {apt_num}" if floor and apt_num else project_name

            price_str = (row.get('Price') or '').strip()
            sale_price = Decimal(price_str) if price_str else None

            percent_str = (row.get('Percent') or '').strip()
            ownership_percent = Decimal(percent_str) if percent_str else None

            customer_name = (row.get('Customer') or '').strip() or None
            customer_key_str = (row.get('CustomerKey') or '').strip()
            customer_key = int(customer_key_str) if customer_key_str else None

            remarks = (row.get('remarks') or '').strip() or None

            apartment = models.Apartment(
                project_id=project_id,
                name=name,
                floor=floor or None,
                apartment_number=apt_num or None,
                customer_name=customer_name,
                customer_key=customer_key,
                sale_price=sale_price,
                ownership_percent=ownership_percent,
                remarks=remarks,
            )
            db.add(apartment)
            imported += 1

    db.commit()

    return {
        "imported": imported,
        "skipped": skipped,
        "unmapped_projects": list(unmapped_projects),
    }
