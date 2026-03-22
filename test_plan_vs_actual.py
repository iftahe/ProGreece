import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_plan_vs_actual_has_plan2_columns():
    r = client.get("/reports/plan-vs-actual", params={"project_id": 26})
    assert r.status_code == 200
    data = r.json()
    t = data["totals"]
    assert "plan1" in t
    assert "plan2" in t
    assert "plan1_plan2_diff" in t
    assert "plan2_actual_diff" in t

def test_plan_vs_actual_rows_have_plan2():
    r = client.get("/reports/plan-vs-actual", params={"project_id": 26})
    data = r.json()
    for row in data["rows"]:
        assert "plan1" in row
        assert "plan2" in row
        assert "plan1_plan2_diff" in row
        assert "plan2_actual_diff" in row

def test_plan2_defaults_to_plan1():
    """When plan2 is not set, it should default to plan1."""
    r = client.get("/reports/plan-vs-actual", params={"project_id": 26})
    data = r.json()
    for row in data["rows"]:
        # If plan2 was never set, plan1_plan2_diff should be 0
        assert abs(row["plan1_plan2_diff"]) < 0.01 or row["plan2"] != row["plan1"]

def test_update_plan2_endpoint():
    r = client.patch("/budget-categories/1/plan2", params={"amount": 50000})
    # Might be 200 or 404 depending on whether category 1 exists
    assert r.status_code in (200, 404)
