"""
Tests for CSV apartment import and portfolio summary endpoints.
"""
import io


# ── CSV Import ────────────────────────────────────────────────────────


def _make_csv(rows: list[dict]) -> bytes:
    """Helper: build a CSV byte string from a list of dicts."""
    if not rows:
        return b"Project,ProjectKey,Floor,Appartment,Price,Percent,Customer,CustomerKey,remarks\n"
    headers = list(rows[0].keys())
    lines = [",".join(headers)]
    for row in rows:
        lines.append(",".join(str(row.get(h, "")) for h in headers))
    return "\n".join(lines).encode("utf-8")


def test_import_apartments_success(client):
    """Valid CSV rows should be imported and matched to existing projects."""
    # Create a project that matches the CSV
    client.post("/projects/", json={"name": "Athens"})

    csv_data = _make_csv([
        {"Project": "Athens", "ProjectKey": "1", "Floor": "3",
         "Appartment": "301", "Price": "250000", "Percent": "100",
         "Customer": "John", "CustomerKey": "10", "remarks": ""},
        {"Project": "Athens", "ProjectKey": "1", "Floor": "3",
         "Appartment": "302", "Price": "180000", "Percent": "50",
         "Customer": "Maria", "CustomerKey": "11", "remarks": "corner unit"},
    ])

    res = client.post(
        "/import/apartments",
        files={"file": ("apartments.csv", io.BytesIO(csv_data), "text/csv")},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["imported"] == 2
    assert data["skipped"] == 0
    assert data["unmapped_projects"] == []


def test_import_apartments_skips_empty_rows(client):
    """Rows with ProjectKey=0 or empty Project should be skipped."""
    client.post("/projects/", json={"name": "Athens"})

    csv_data = _make_csv([
        {"Project": "Athens", "ProjectKey": "1", "Floor": "1",
         "Appartment": "101", "Price": "100000", "Percent": "",
         "Customer": "", "CustomerKey": "", "remarks": ""},
        {"Project": "", "ProjectKey": "0", "Floor": "",
         "Appartment": "", "Price": "", "Percent": "",
         "Customer": "", "CustomerKey": "", "remarks": ""},
    ])

    res = client.post(
        "/import/apartments",
        files={"file": ("apartments.csv", io.BytesIO(csv_data), "text/csv")},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["imported"] == 1
    assert data["skipped"] == 1


def test_import_apartments_unmapped_project(client):
    """CSV with a project name that doesn't exist should report it."""
    csv_data = _make_csv([
        {"Project": "Nonexistent", "ProjectKey": "1", "Floor": "1",
         "Appartment": "101", "Price": "50000", "Percent": "",
         "Customer": "Test", "CustomerKey": "1", "remarks": ""},
    ])

    res = client.post(
        "/import/apartments",
        files={"file": ("apartments.csv", io.BytesIO(csv_data), "text/csv")},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["imported"] == 0
    assert data["skipped"] == 1
    assert "Nonexistent" in data["unmapped_projects"]


def test_import_apartments_case_insensitive_matching(client):
    """Project name matching should be case-insensitive."""
    client.post("/projects/", json={"name": "Athens"})

    csv_data = _make_csv([
        {"Project": "ATHENS", "ProjectKey": "1", "Floor": "1",
         "Appartment": "101", "Price": "200000", "Percent": "",
         "Customer": "", "CustomerKey": "", "remarks": ""},
    ])

    res = client.post(
        "/import/apartments",
        files={"file": ("apartments.csv", io.BytesIO(csv_data), "text/csv")},
    )
    assert res.status_code == 200
    assert res.json()["imported"] == 1


# ── Portfolio Summary ─────────────────────────────────────────────────


def test_portfolio_summary_empty(client):
    """Portfolio summary with no projects should return empty."""
    res = client.get("/reports/portfolio-summary")
    assert res.status_code == 200
    data = res.json()
    assert data["projects"] == []
    assert data["totals"]["project_count"] == 0


def test_portfolio_summary_with_data(client, sample_project, sample_apartment):
    """Portfolio summary should aggregate project data."""
    apt_id = sample_apartment["id"]

    # Add a payment so collection data is non-zero
    client.post(f"/apartments/{apt_id}/payments", json={
        "date": "2025-02-01T00:00:00",
        "amount": 100000.0,
        "payment_method": "Bank Transfer",
    })

    res = client.get("/reports/portfolio-summary")
    assert res.status_code == 200
    data = res.json()
    assert data["totals"]["project_count"] == 1

    proj = data["projects"][0]
    assert proj["name"] == "Test Project"
    assert proj["apartments_count"] == 1
    assert float(proj["total_collected"]) == 100000.0
    assert float(proj["total_revenue"]) == 250000.0
    assert proj["collection_rate"] == 40.0  # 100k / 250k


def test_portfolio_summary_excludes_inactive_projects(client, db):
    """Only Active and Completed projects should appear in summary."""
    import models as m
    active = m.Project(name="Active One", status="Active")
    completed = m.Project(name="Completed One", status="Completed")
    draft = m.Project(name="Draft One", status="Draft")
    db.add_all([active, completed, draft])
    db.commit()

    res = client.get("/reports/portfolio-summary")
    assert res.status_code == 200
    names = {p["name"] for p in res.json()["projects"]}
    assert "Active One" in names
    assert "Completed One" in names
    assert "Draft One" not in names
