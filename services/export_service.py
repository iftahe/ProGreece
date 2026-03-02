from io import BytesIO
from decimal import Decimal
import openpyxl
from openpyxl.styles import Font, PatternFill
from datetime import datetime

def export_to_excel(report_name: str, rows: list, totals: dict = None, filters: dict = None) -> BytesIO:
    """Export report data to Excel format, returns BytesIO buffer."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = report_name[:31]  # Excel sheet name max 31 chars

    # Metadata sheet
    meta_ws = wb.create_sheet("Metadata")
    meta_ws["A1"] = "Report"
    meta_ws["B1"] = report_name
    meta_ws["A2"] = "Generated"
    meta_ws["B2"] = datetime.now().isoformat()
    if filters:
        row = 3
        for k, v in filters.items():
            meta_ws.cell(row=row, column=1, value=k)
            meta_ws.cell(row=row, column=2, value=str(v) if v is not None else "")
            row += 1

    # Data: write headers from first row keys
    if rows:
        headers = list(rows[0].keys())
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.font = Font(bold=True)

        row_idx = 1
        for row_idx, row_data in enumerate(rows, 2):
            for col, key in enumerate(headers, 1):
                val = row_data.get(key)
                if isinstance(val, Decimal):
                    val = float(val)
                ws.cell(row=row_idx, column=col, value=val)

        # Totals row if provided
        if totals:
            totals_row = row_idx + 1
            ws.cell(row=totals_row, column=1, value="TOTALS").font = Font(bold=True)
            for col, key in enumerate(headers, 1):
                if key in totals:
                    val = totals[key]
                    if isinstance(val, Decimal):
                        val = float(val)
                    ws.cell(row=totals_row, column=col, value=val)

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer
