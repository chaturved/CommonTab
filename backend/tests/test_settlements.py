from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

from helpers import client_for, create_group, expense, headers, join, m, register


def setup(database, amount=10000):
    api = client_for(database)
    ada = register(api, 'ada@example.com', 'Ada')
    bob = register(api, 'bob@example.com', 'Bob')
    group = create_group(api, ada)
    join(api, group, ada, bob)
    aid, bid = m(ada, group), m(bob, group)
    record = expense(group, aid, [aid, bid], amount=amount)
    assert api.put(f"/v1/groups/{group['id']}/expenses/{record['id']}", headers=headers(ada), json=record).status_code == 200
    return api, ada, bob, group, f"/v1/groups/{group['id']}/settlements"


def pay(group, bob, ada, amount, id=None):
    return {'id': id or str(uuid4()), 'fromID': m(bob, group), 'toID': m(ada, group), 'amountMinor': amount}


def snapshot(api, group, user):
    return api.get(f"/v1/groups/{group['id']}", headers=headers(user)).json()


def test_no_group_version_is_needed(database):
    api, ada, bob, group, endpoint = setup(database)
    response = api.post(endpoint, headers=headers(bob), json=pay(group, bob, ada, 5000))
    assert response.status_code == 201, response.text


def test_a_stale_or_wrong_group_version_is_ignored(database):
    api, ada, bob, group, endpoint = setup(database)
    assert api.post(endpoint, headers=headers(bob), json={**pay(group, bob, ada, 1000), 'groupVersion': 1}).status_code == 201
    assert api.post(endpoint, headers=headers(bob), json={**pay(group, bob, ada, 1000), 'groupVersion': 999}).status_code == 201


def test_a_payment_queued_offline_still_applies_after_other_changes(database):
    api, ada, bob, group, endpoint = setup(database)
    queued = pay(group, bob, ada, 5000)  # made while offline
    api.patch(f"/v1/groups/{group['id']}", headers=headers(ada), json={'name': 'Renamed'})  # group version moves on
    extra = expense(group, m(ada, group), [m(ada, group), m(bob, group)], amount=2)
    api.put(f"/v1/groups/{group['id']}/expenses/{extra['id']}", headers=headers(ada), json=extra)
    assert api.post(endpoint, headers=headers(bob), json=queued).status_code == 201


def test_repeating_a_settlement_returns_the_stored_one_and_changes_nothing(database):
    api, ada, bob, group, endpoint = setup(database)
    payment = pay(group, bob, ada, 3000)
    first = api.post(endpoint, headers=headers(bob), json=payment)
    assert first.status_code == 201
    before = snapshot(api, group, ada)
    retry = api.post(endpoint, headers=headers(bob), json=payment)
    assert retry.status_code == 200
    assert retry.json() == first.json()
    after = snapshot(api, group, ada)
    assert len(after['settlements']) == 1
    assert after['version'] == before['version']
    assert after['balances'] == before['balances']
    # either participant may repeat it
    assert api.post(endpoint, headers=headers(ada), json=payment).status_code == 200


def test_the_same_id_with_a_different_payment_is_a_conflict(database):
    api, ada, bob, group, endpoint = setup(database)
    payment = pay(group, bob, ada, 3000)
    api.post(endpoint, headers=headers(bob), json=payment)
    response = api.post(endpoint, headers=headers(bob), json={**payment, 'amountMinor': 2000})
    assert response.status_code == 409
    assert response.json()['code'] == 'id_conflict'
    assert len(snapshot(api, group, ada)['settlements']) == 1


def test_overpayment_is_rejected_with_the_most_that_can_be_paid(database):
    api, ada, bob, group, endpoint = setup(database)  # Bob owes Ada 5000
    response = api.post(endpoint, headers=headers(bob), json=pay(group, bob, ada, 5001))
    assert response.status_code == 422
    body = response.json()
    assert body['code'] == 'exceeds_balance'
    assert body['maxAmountMinor'] == 5000
    assert 'exceeds' in body['detail']
    assert snapshot(api, group, ada)['settlements'] == []


def test_paying_in_the_wrong_direction_says_nothing_is_owed(database):
    api, ada, bob, group, endpoint = setup(database)
    backwards = {'id': str(uuid4()), 'fromID': m(ada, group), 'toID': m(bob, group), 'amountMinor': 100}
    response = api.post(endpoint, headers=headers(ada), json=backwards)
    assert response.status_code == 422
    assert response.json()['maxAmountMinor'] == 0
    assert response.json()['detail'] == 'Nothing is owed between these members'


def test_a_paid_up_balance_cannot_be_paid_again(database):
    api, ada, bob, group, endpoint = setup(database)
    assert api.post(endpoint, headers=headers(bob), json=pay(group, bob, ada, 5000)).status_code == 201
    again = api.post(endpoint, headers=headers(bob), json=pay(group, bob, ada, 1))  # new id
    assert again.status_code == 422 and again.json()['maxAmountMinor'] == 0


def test_two_payments_racing_for_the_same_balance_cannot_both_succeed(database):
    api, ada, bob, group, endpoint = setup(database)  # Bob owes 5000

    def attempt(_):
        # a TestClient per thread; both talk to the same database
        client = client_for(database)
        return client.post(endpoint, headers=headers(bob), json=pay(group, bob, ada, 5000)).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = sorted(pool.map(attempt, range(2)))
    assert statuses == [201, 422]
    final = snapshot(api, group, ada)
    assert len(final['settlements']) == 1
    assert all(b['minorUnits'] == 0 for b in final['balances'])
