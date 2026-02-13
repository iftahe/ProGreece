"""
Tests for Phase 2: Budget Plans CRUD and Budget Items endpoints.
"""


# ── Budget Items (read-only via API) ──────────────────────────────────


def test_list_budget_items(client, sample_budget_category):
    pid = sample_budget_category.project_id
    res = client.get(f"/projects/{pid}/budget-items")
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 1
    assert items[0]["category_name"] == "Construction"
    assert float(items[0]["planned_amount"]) == 100000.0


def test_list_budget_items_empty(client, sample_project):
    pid = sample_project["id"]
    res = client.get(f"/projects/{pid}/budget-items")
    assert res.status_code == 200
    assert res.json() == []


# ── Budget Plans ──────────────────────────────────────────────────────


def test_create_budget_plan(client, sample_budget_category):
    cat_id = sample_budget_category.id
    res = client.post(f"/budget-categories/{cat_id}/plans", json={
        "planned_date": "2025-03-01T00:00:00",
        "amount": 25000.0,
        "description": "Foundation work",
    })
    assert res.status_code == 200
    data = res.json()
    assert float(data["amount"]) == 25000.0
    assert data["description"] == "Foundation work"
    assert data["budget_category_id"] == cat_id


def test_create_budget_plan_category_not_found(client):
    res = client.post("/budget-categories/99999/plans", json={
        "planned_date": "2025-01-01T00:00:00",
        "amount": 1000.0,
    })
    assert res.status_code == 404


def test_list_budget_plans(client, sample_budget_category):
    cat_id = sample_budget_category.id
    # Create multiple plans
    for i in range(3):
        client.post(f"/budget-categories/{cat_id}/plans", json={
            "planned_date": f"2025-0{i+1}-01T00:00:00",
            "amount": 10000.0 * (i + 1),
        })
    res = client.get(f"/budget-categories/{cat_id}/plans")
    assert res.status_code == 200
    plans = res.json()
    assert len(plans) == 3
    # Should be ordered by planned_date
    dates = [p["planned_date"] for p in plans]
    assert dates == sorted(dates)


def test_update_budget_plan(client, sample_budget_category):
    cat_id = sample_budget_category.id
    create_res = client.post(f"/budget-categories/{cat_id}/plans", json={
        "planned_date": "2025-04-01T00:00:00",
        "amount": 15000.0,
        "description": "Original",
    })
    plan_id = create_res.json()["id"]

    res = client.put(f"/budget-plans/{plan_id}", json={
        "planned_date": "2025-05-01T00:00:00",
        "amount": 20000.0,
        "description": "Revised estimate",
    })
    assert res.status_code == 200
    data = res.json()
    assert float(data["amount"]) == 20000.0
    assert data["description"] == "Revised estimate"


def test_update_budget_plan_not_found(client):
    res = client.put("/budget-plans/99999", json={
        "planned_date": "2025-01-01T00:00:00",
        "amount": 1000.0,
    })
    assert res.status_code == 404


def test_delete_budget_plan(client, sample_budget_category):
    cat_id = sample_budget_category.id
    create_res = client.post(f"/budget-categories/{cat_id}/plans", json={
        "planned_date": "2025-06-01T00:00:00",
        "amount": 5000.0,
    })
    plan_id = create_res.json()["id"]

    res = client.delete(f"/budget-plans/{plan_id}")
    assert res.status_code == 200

    # Verify gone
    plans = client.get(f"/budget-categories/{cat_id}/plans").json()
    assert all(p["id"] != plan_id for p in plans)


def test_delete_budget_plan_not_found(client):
    res = client.delete("/budget-plans/99999")
    assert res.status_code == 404


def test_budget_plan_crud_lifecycle(client, sample_budget_category):
    """Full lifecycle: create -> list -> update -> delete."""
    cat_id = sample_budget_category.id

    # Create
    plan = client.post(f"/budget-categories/{cat_id}/plans", json={
        "planned_date": "2025-07-01T00:00:00",
        "amount": 30000.0,
        "description": "Electrical work",
    }).json()
    plan_id = plan["id"]

    # List
    plans = client.get(f"/budget-categories/{cat_id}/plans").json()
    assert len(plans) == 1

    # Update
    updated = client.put(f"/budget-plans/{plan_id}", json={
        "planned_date": "2025-08-01T00:00:00",
        "amount": 35000.0,
        "description": "Electrical + plumbing",
    }).json()
    assert float(updated["amount"]) == 35000.0

    # Delete
    client.delete(f"/budget-plans/{plan_id}")
    plans = client.get(f"/budget-categories/{cat_id}/plans").json()
    assert len(plans) == 0
