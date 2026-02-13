"""
Tests for Phase 2: Apartments & Customer Payments CRUD endpoints.
"""


# ── Apartments ────────────────────────────────────────────────────────


def test_create_apartment(client, sample_project):
    pid = sample_project["id"]
    res = client.post(f"/projects/{pid}/apartments", json={
        "name": "Floor 2 - Apt 201",
        "floor": "2",
        "apartment_number": "201",
        "customer_name": "Maria K.",
        "sale_price": 300000.0,
        "ownership_percent": 100.0,
    })
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Floor 2 - Apt 201"
    assert data["customer_name"] == "Maria K."
    assert float(data["sale_price"]) == 300000.0
    assert float(data["total_paid"]) == 0
    assert float(data["remaining"]) == 300000.0


def test_create_apartment_project_not_found(client):
    res = client.post("/projects/99999/apartments", json={
        "name": "Ghost Apt",
    })
    assert res.status_code == 404


def test_list_apartments(client, sample_project):
    pid = sample_project["id"]
    # Create two apartments
    for i in range(2):
        client.post(f"/projects/{pid}/apartments", json={
            "name": f"Apt {i+1}",
            "sale_price": 100000.0 * (i + 1),
        })
    res = client.get(f"/projects/{pid}/apartments")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


def test_list_apartments_scoped_to_project(client):
    """Apartments from project A should not appear when listing project B."""
    p1 = client.post("/projects/", json={"name": "Project A"}).json()
    p2 = client.post("/projects/", json={"name": "Project B"}).json()

    client.post(f"/projects/{p1['id']}/apartments", json={"name": "Apt A"})
    client.post(f"/projects/{p2['id']}/apartments", json={"name": "Apt B"})

    data_a = client.get(f"/projects/{p1['id']}/apartments").json()
    data_b = client.get(f"/projects/{p2['id']}/apartments").json()

    assert len(data_a["items"]) == 1
    assert data_a["items"][0]["name"] == "Apt A"
    assert len(data_b["items"]) == 1
    assert data_b["items"][0]["name"] == "Apt B"


def test_update_apartment(client, sample_apartment):
    apt_id = sample_apartment["id"]
    res = client.put(f"/apartments/{apt_id}", json={
        "name": "Renamed Apt",
        "floor": "3",
        "apartment_number": "301",
        "customer_name": "New Owner",
        "sale_price": 400000.0,
    })
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Renamed Apt"
    assert data["customer_name"] == "New Owner"
    assert float(data["sale_price"]) == 400000.0


def test_update_apartment_not_found(client):
    res = client.put("/apartments/99999", json={"name": "Ghost"})
    assert res.status_code == 404


def test_delete_apartment(client, sample_apartment):
    apt_id = sample_apartment["id"]
    res = client.delete(f"/apartments/{apt_id}")
    assert res.status_code == 200

    # Verify gone from listing
    pid = sample_apartment["project_id"]
    data = client.get(f"/projects/{pid}/apartments").json()
    assert all(a["id"] != apt_id for a in data["items"])


def test_delete_apartment_not_found(client):
    res = client.delete("/apartments/99999")
    assert res.status_code == 404


def test_apartment_total_paid_and_remaining(client, sample_apartment):
    """total_paid and remaining should reflect payments made."""
    apt_id = sample_apartment["id"]
    pid = sample_apartment["project_id"]

    # Add two payments
    client.post(f"/apartments/{apt_id}/payments", json={
        "date": "2025-01-15T00:00:00",
        "amount": 80000.0,
        "payment_method": "Bank Transfer",
    })
    client.post(f"/apartments/{apt_id}/payments", json={
        "date": "2025-03-20T00:00:00",
        "amount": 50000.0,
        "payment_method": "Trust Account",
    })

    # Re-fetch apartment list and check computed fields
    data = client.get(f"/projects/{pid}/apartments").json()
    apt = next(a for a in data["items"] if a["id"] == apt_id)
    assert float(apt["total_paid"]) == 130000.0
    assert float(apt["remaining"]) == 120000.0  # 250000 - 130000


# ── Customer Payments ─────────────────────────────────────────────────


def test_create_payment(client, sample_apartment):
    apt_id = sample_apartment["id"]
    res = client.post(f"/apartments/{apt_id}/payments", json={
        "date": "2025-02-01T00:00:00",
        "amount": 50000.0,
        "payment_method": "Bank Transfer",
        "notes": "First installment",
    })
    assert res.status_code == 200
    data = res.json()
    assert float(data["amount"]) == 50000.0
    assert data["payment_method"] == "Bank Transfer"
    assert data["notes"] == "First installment"
    assert data["apartment_id"] == apt_id


def test_create_payment_apartment_not_found(client):
    res = client.post("/apartments/99999/payments", json={
        "date": "2025-01-01T00:00:00",
        "amount": 1000.0,
        "payment_method": "Bank Transfer",
    })
    assert res.status_code == 404


def test_list_payments(client, sample_apartment):
    apt_id = sample_apartment["id"]
    for i in range(3):
        client.post(f"/apartments/{apt_id}/payments", json={
            "date": f"2025-0{i+1}-15T00:00:00",
            "amount": 10000.0 * (i + 1),
            "payment_method": "Bank Transfer",
        })
    res = client.get(f"/apartments/{apt_id}/payments")
    assert res.status_code == 200
    payments = res.json()
    assert len(payments) == 3


def test_update_payment(client, sample_apartment):
    apt_id = sample_apartment["id"]
    # Create a payment
    create_res = client.post(f"/apartments/{apt_id}/payments", json={
        "date": "2025-04-01T00:00:00",
        "amount": 25000.0,
        "payment_method": "Cash",
    })
    pay_id = create_res.json()["id"]

    # Update it
    res = client.put(f"/payments/{pay_id}", json={
        "date": "2025-04-15T00:00:00",
        "amount": 30000.0,
        "payment_method": "Bank Transfer",
        "notes": "Corrected amount",
    })
    assert res.status_code == 200
    data = res.json()
    assert float(data["amount"]) == 30000.0
    assert data["payment_method"] == "Bank Transfer"
    assert data["notes"] == "Corrected amount"


def test_update_payment_not_found(client):
    res = client.put("/payments/99999", json={
        "date": "2025-01-01T00:00:00",
        "amount": 1000.0,
        "payment_method": "Bank Transfer",
    })
    assert res.status_code == 404


def test_delete_payment(client, sample_apartment):
    apt_id = sample_apartment["id"]
    create_res = client.post(f"/apartments/{apt_id}/payments", json={
        "date": "2025-05-01T00:00:00",
        "amount": 15000.0,
        "payment_method": "Bank Transfer",
    })
    pay_id = create_res.json()["id"]

    res = client.delete(f"/payments/{pay_id}")
    assert res.status_code == 200

    # Verify gone
    payments = client.get(f"/apartments/{apt_id}/payments").json()
    assert all(p["id"] != pay_id for p in payments)


def test_delete_payment_not_found(client):
    res = client.delete("/payments/99999")
    assert res.status_code == 404


def test_payment_methods(client, sample_apartment):
    """All valid payment methods should be accepted."""
    apt_id = sample_apartment["id"]
    methods = ["Bank Transfer", "Trust Account", "Cash", "Direct to Owner"]
    for method in methods:
        res = client.post(f"/apartments/{apt_id}/payments", json={
            "date": "2025-06-01T00:00:00",
            "amount": 1000.0,
            "payment_method": method,
        })
        assert res.status_code == 200, f"Failed for method: {method}"
        assert res.json()["payment_method"] == method


def test_cascade_delete_apartment_removes_payments(client, sample_project):
    """Deleting an apartment should cascade-delete its payments."""
    pid = sample_project["id"]
    apt = client.post(f"/projects/{pid}/apartments", json={
        "name": "Cascade Test Apt",
        "sale_price": 100000.0,
    }).json()
    apt_id = apt["id"]

    # Add payments
    client.post(f"/apartments/{apt_id}/payments", json={
        "date": "2025-01-01T00:00:00",
        "amount": 5000.0,
        "payment_method": "Bank Transfer",
    })

    # Delete apartment
    res = client.delete(f"/apartments/{apt_id}")
    assert res.status_code == 200

    # Payments endpoint should return empty (apartment gone, so 404 or empty)
    # The endpoint checks apartment_id filter — since apt is gone, no results
    pay_res = client.get(f"/apartments/{apt_id}/payments")
    assert pay_res.status_code == 200
    assert pay_res.json() == []
