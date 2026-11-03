from uuid import uuid4
from io import BytesIO
from PIL import Image

from fastapi.testclient import TestClient

from app.main import create_app

from helpers import create_group, expense, headers, join, register


def client(database):
    return TestClient(create_app(database))


def test_account_auth_and_private_group(database):
    api = client(database)
    ada = register(api, 'ADA@example.com', 'Ada')
    bob = register(api, 'bob@example.com', 'Bob')
    group = create_group(api, ada)
    assert api.get('/v1/me', headers=headers(ada)).json()['email'] == 'ada@example.com'
    assert api.get(f"/v1/groups/{group['id']}", headers=headers(bob)).status_code == 404
    assert api.get('/v1/groups').status_code == 401
    assert api.post('/v1/auth/sessions', json={'email': 'ada@example.com', 'password': 'wrong'}).status_code == 401
    join(api, group, ada, bob)
    assert len(api.get(f"/v1/groups/{group['id']}", headers=headers(bob)).json()['members']) == 2
    api.delete('/v1/auth/sessions', headers=headers(ada))
    assert api.get('/v1/me', headers=headers(ada)).status_code == 401


def test_allocation_balance_settlement_and_versions(database):
    api = client(database)
    ada = register(api, 'ada@example.com', 'Ada')
    bob = register(api, 'bob@example.com', 'Bob')
    group = create_group(api, ada)
    join(api, group, ada, bob)
    aid, bid = ada['user']['id'], bob['user']['id']
    payload = expense(group, aid, [aid, bid])
    url = f"/v1/groups/{group['id']}/expenses/{payload['id']}"
    saved = api.put(url, headers=headers(ada), json=payload)
    assert saved.status_code == 200, saved.text
    assert saved.json()['allocations'] == [{'memberID': aid, 'minorUnits': 5001},
                                           {'memberID': bid, 'minorUnits': 5000}]
    current = api.get(f"/v1/groups/{group['id']}", headers=headers(bob)).json()
    assert {v['memberID']: v['minorUnits'] for v in current['balances']} == {aid: 5000, bid: -5000}
    assert api.put(url, headers=headers(ada), json=payload).status_code == 409
    payload['version'] = 1
    payload['amountMinor'] = 10000
    assert api.put(url, headers=headers(bob), json=payload).json()['version'] == 2
    assert api.delete(url + '?version=1', headers=headers(ada)).status_code == 409
    settled = api.post(f"/v1/groups/{group['id']}/settlements", headers=headers(bob), json={
        'id': str(uuid4()), 'groupVersion': api.get(f"/v1/groups/{group['id']}", headers=headers(bob)).json()['version'],
        'fromID': bid, 'toID': aid, 'amountMinor': 5000
    })
    assert settled.status_code == 201, settled.text
    assert all(v['minorUnits'] == 0 for v in api.get(f"/v1/groups/{group['id']}",
                                                     headers=headers(ada)).json()['balances'])
    assert api.delete(url + '?version=2', headers=headers(ada)).status_code == 204


def test_exact_percentage_and_receipt_access(database):
    api = client(database)
    ada = register(api, 'ada@example.com', 'Ada')
    bob = register(api, 'bob@example.com', 'Bob')
    outsider = register(api, 'eve@example.com', 'Eve')
    group = create_group(api, ada)
    join(api, group, ada, bob)
    aid, bid = ada['user']['id'], bob['user']['id']
    record = expense(group, aid, [aid, bid], 'percentage', ['33.33', '66.67'])
    url = f"/v1/groups/{group['id']}/expenses/{record['id']}"
    response = api.put(url, headers=headers(ada), json=record)
    assert response.status_code == 200, response.text
    assert sum(share['minorUnits'] for share in response.json()['allocations']) == 10001
    exact = expense(group, aid, [aid, bid], 'exact', ['1', '10000'])
    assert api.put(f"/v1/groups/{group['id']}/expenses/{exact['id']}",
                   headers=headers(ada), json=exact).status_code == 200
    exact['values'] = ['1', '9999']
    exact['id'] = str(uuid4())
    assert api.put(f"/v1/groups/{group['id']}/expenses/{exact['id']}",
                   headers=headers(ada), json=exact).status_code == 422
    receipt_url = url + '/receipt'
    stream = BytesIO()
    metadata = Image.Exif()
    metadata[315] = 'private camera metadata'
    Image.new('RGB', (2, 2), 'white').save(stream, format='JPEG', exif=metadata)
    image = stream.getvalue()
    assert api.put(receipt_url, headers={**headers(ada), 'Content-Type': 'image/jpeg'}, content=image).status_code == 200
    assert api.get(receipt_url, headers=headers(bob)).headers['content-type'] == 'image/jpeg'
    saved_image = api.get(receipt_url, headers=headers(bob)).content
    assert saved_image.startswith(b'\xff\xd8\xff')
    assert not Image.open(BytesIO(saved_image)).getexif()
    assert api.get(receipt_url, headers=headers(outsider)).status_code == 404
    assert api.put(receipt_url, headers={**headers(ada), 'Content-Type': 'image/jpeg'}, content=b'fake').status_code == 422
    assert api.delete(receipt_url, headers=headers(ada)).status_code == 204
    assert api.get(receipt_url, headers=headers(ada)).status_code == 404


def test_profile_group_and_invitation_permissions(database):
    api = client(database)
    ada = register(api, 'ada@example.com', 'Ada')
    bob = register(api, 'bob@example.com', 'Bob')
    eve = register(api, 'eve@example.com', 'Eve')
    group = create_group(api, ada)
    url = f"/v1/groups/{group['id']}"
    assert api.post('/v1/accounts', json={
        'email': 'ADA@example.com', 'name': 'Another Ada', 'password': 'correct horse battery staple'
    }).status_code == 409
    assert api.patch('/v1/me', headers=headers(ada), json={'name': '  Ada Lovelace  '}).json()['name'] == 'Ada Lovelace'
    assert api.patch('/v1/me', headers=headers(ada), json={'name': '   '}).status_code == 422
    assert api.patch(url, headers=headers(bob), json={'name': 'Hijacked'}).status_code == 404
    renamed = api.patch(url, headers=headers(ada), json={'name': 'Summer trip'})
    assert renamed.json()['name'] == 'Summer trip'
    assert renamed.json()['version'] == group['version'] + 1

    invitation = api.post(url + '/invitations', headers=headers(ada), json={'email': 'BOB@example.com'})
    assert invitation.status_code == 201
    token = invitation.json()['inviteToken']
    assert api.post('/v1/invitations/accept', headers=headers(eve), json={'inviteToken': token}).status_code == 403
    assert api.get(url, headers=headers(eve)).status_code == 404
    assert api.post('/v1/invitations/accept', headers=headers(bob), json={'inviteToken': token}).status_code == 200
    assert api.post(url + '/invitations', headers=headers(ada), json={'email': 'bob@example.com'}).status_code == 409


def test_shared_expense_validation_and_persistence_after_restart(database):
    api = TestClient(create_app(database))
    ada = register(api, 'ada@example.com', 'Ada')
    outsider = register(api, 'eve@example.com', 'Eve')
    group = create_group(api, ada)
    aid = ada['user']['id']
    record = expense(group, aid, [aid], amount=4250)
    url = f"/v1/groups/{group['id']}/expenses/{record['id']}"
    assert api.put(url, headers=headers(ada), json={**record, 'payerID': outsider['user']['id']}).status_code == 422
    assert api.put(url, headers=headers(ada), json={**record, 'participants': [aid, aid]}).status_code == 422
    assert api.put(url, headers=headers(ada), json={**record, 'occurredAt': '2026-09-30T12:00:00'}).status_code == 422
    assert api.put(url, headers=headers(outsider), json=record).status_code == 404
    assert api.put(url, headers=headers(ada), json=record).status_code == 200

    restarted = TestClient(create_app(database))
    loaded = restarted.get(f"/v1/groups/{group['id']}", headers=headers(ada))
    assert loaded.status_code == 200
    assert loaded.json()['expenses'][0]['amountMinor'] == 4250
    assert loaded.json()['balances'] == [{'memberID': aid, 'minorUnits': 0}]
    receipt_url = url + '/receipt'
    assert restarted.put(receipt_url, headers={**headers(ada), 'Content-Type': 'text/plain'},
                         content=b'not an image').status_code == 422
    assert restarted.put(receipt_url, headers={**headers(ada), 'Content-Type': 'image/png'},
                         content=b'\x89PNG\r\n\x1a\n' + b'0' * (5 * 1024 * 1024)).status_code == 413
    assert restarted.get(receipt_url, headers=headers(ada)).status_code == 404


def test_settlement_rejects_stale_group_and_overpayment(database):
    api = client(database)
    ada = register(api, 'ada@example.com', 'Ada')
    bob = register(api, 'bob@example.com', 'Bob')
    eve = register(api, 'eve@example.com', 'Eve')
    group = create_group(api, ada)
    join(api, group, ada, bob)
    join(api, group, ada, eve)
    aid, bid = ada['user']['id'], bob['user']['id']
    record = expense(group, aid, [aid, bid], amount=1000)
    assert api.put(f"/v1/groups/{group['id']}/expenses/{record['id']}",
                   headers=headers(ada), json=record).status_code == 200
    state = api.get(f"/v1/groups/{group['id']}", headers=headers(bob)).json()
    settlement = {'id': str(uuid4()), 'groupVersion': state['version'],
                  'fromID': bid, 'toID': aid, 'amountMinor': 500}
    endpoint = f"/v1/groups/{group['id']}/settlements"
    assert api.post(endpoint, headers=headers(eve), json=settlement).status_code == 403
    assert api.post(endpoint, headers=headers(bob), json={**settlement, 'amountMinor': 501}).status_code == 422
    assert api.patch(f"/v1/groups/{group['id']}", headers=headers(ada), json={'name': 'Renamed'}).status_code == 200
    assert api.post(endpoint, headers=headers(bob), json=settlement).status_code == 409
    settlement['groupVersion'] += 1
    assert api.post(endpoint, headers=headers(bob), json=settlement).status_code == 201
    assert api.post(endpoint, headers=headers(bob), json=settlement).status_code == 422
