from uuid import uuid4

from helpers import client_for


def sample_bill() -> dict:
    person_id = str(uuid4())
    return {
        "people": [{"id": person_id, "name": "Alex"}],
        "items": [{
            "id": str(uuid4()),
            "name": "Pasta",
            "price": "19.99",
            "assignedPersonIDs": [person_id],
        }],
        "tax": "1.60",
        "tipPercentage": "18",
        "receiptTotal": "21.59",
    }


class TestSessions:
    def test_create_read_update_and_version_conflict(self, database):
        client = client_for(database)
        bill = sample_bill()

        created = client.post("/v1/sessions", json={"bill": bill})
        assert created.status_code == 201
        session = created.json()
        assert session["version"] == 1
        assert session["bill"]["items"][0]["price"] == "19.99"

        url = f"/v1/sessions/{session['id']}"
        headers = {"Authorization": f"Bearer {session['accessToken']}"}
        assert client.get(url, headers=headers).json()["bill"] == session["bill"]

        bill["items"][0]["name"] = "Pizza"
        updated = client.put(url, headers=headers, json={"version": 1, "bill": bill})
        assert updated.status_code == 200
        assert updated.json()["version"] == 2
        assert updated.json()["bill"]["items"][0]["name"] == "Pizza"

        stale = client.put(url, headers=headers, json={"version": 1, "bill": bill})
        assert stale.status_code == 409

    def test_session_requires_secret(self, database):
        client = client_for(database)
        session = client.post("/v1/sessions", json={"bill": sample_bill()}).json()
        url = f"/v1/sessions/{session['id']}"

        assert client.get(url).status_code == 401
        assert client.get(url, headers={"Authorization": "Bearer incorrect"}).status_code == 404

    def test_rejects_unknown_item_assignment(self, database):
        client = client_for(database)
        bill = sample_bill()
        bill["items"][0]["assignedPersonIDs"] = [str(uuid4())]

        response = client.post("/v1/sessions", json={"bill": bill})
        assert response.status_code == 422

    def test_expired_session(self, database):
        client = client_for(database, bill_session_lifetime_seconds=-1)
        session = client.post("/v1/sessions", json={"bill": sample_bill()}).json()
        url = f"/v1/sessions/{session['id']}"

        response = client.get(url, headers={"Authorization": f"Bearer {session['accessToken']}"})
        assert response.status_code == 410

    def test_anonymous_event_counts_and_protected_metrics(self, database):
        client = client_for(database, metrics_token="admin-secret")
        for _ in range(2):
            assert client.post("/v1/events", json={"name": "scan_opened", "variant": "B"}).status_code == 202
        assert client.post("/v1/events", json={"name": "unknown", "variant": "B"}).status_code == 422
        assert client.get("/v1/metrics").status_code == 401
        assert client.get("/v1/metrics", headers={"Authorization": "Bearer wrong"}).status_code == 403
        response = client.get("/v1/metrics", headers={"Authorization": "Bearer admin-secret"})
        assert response.json() == {"counts": [{"name": "scan_opened", "variant": "B", "count": 2}]}
