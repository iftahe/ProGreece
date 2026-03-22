import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_forecast_drilldown_endpoint():
    r = client.get("/reports/forecast/drilldown/26/2023-01")
    assert r.status_code == 200
    data = r.json()
    assert "inflow_items" in data
    assert "outflow_items" in data
    assert "inflow_total" in data
    assert "outflow_total" in data
    assert data["month"] == "2023-01"
    assert data["project_id"] == 26

def test_forecast_drilldown_bad_format():
    r = client.get("/reports/forecast/drilldown/26/2023")
    assert r.status_code == 400

def test_forecast_drilldown_totals_match_items():
    r = client.get("/reports/forecast/drilldown/26/2023-01")
    data = r.json()
    calc_inflow = sum(i["amount"] for i in data["inflow_items"])
    calc_outflow = sum(i["amount"] for i in data["outflow_items"])
    assert abs(data["inflow_total"] - calc_inflow) < 0.01
    assert abs(data["outflow_total"] - calc_outflow) < 0.01

def test_forecast_drilldown_items_have_required_fields():
    r = client.get("/reports/forecast/drilldown/26/2023-01")
    data = r.json()
    for item in data["inflow_items"] + data["outflow_items"]:
        assert "date" in item
        assert "category" in item
        assert "counterparty" in item
        assert "amount" in item
        assert "status" in item
        assert item["status"] in ("executed", "planned", "expected")
