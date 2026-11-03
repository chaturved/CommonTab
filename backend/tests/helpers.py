"""Shared helpers for the HTTP tests."""
from uuid import uuid4


def register(client, email, name):
    response = client.post('/v1/accounts', json={
        'email': email, 'name': name, 'password': 'correct horse battery staple'
    })
    assert response.status_code == 201, response.text
    return response.json()


def headers(account):
    return {'Authorization': f"Bearer {account['accessToken']}"}


def create_group(client, account):
    response = client.post('/v1/groups', headers=headers(account), json={'name': 'Trip', 'currencyCode': 'USD'})
    assert response.status_code == 201, response.text
    return response.json()


def join(client, group, inviter, invitee):
    invitation = client.post(f"/v1/groups/{group['id']}/invitations", headers=headers(inviter),
                             json={'email': invitee['user']['email']})
    assert invitation.status_code == 201, invitation.text
    token = invitation.json()['inviteToken']
    accepted = client.post('/v1/invitations/accept', headers=headers(invitee), json={'inviteToken': token})
    assert accepted.status_code == 200, accepted.text
    assert client.post('/v1/invitations/accept', headers=headers(invitee),
                       json={'inviteToken': token}).status_code == 404


def expense(group, payer, participants, method='equal', values=None, amount=10001):
    return {'id': str(uuid4()), 'merchant': 'Groceries', 'occurredAt': '2026-09-30T12:00:00Z',
            'category': 'groceries', 'notes': '', 'amountMinor': amount, 'payerID': payer,
            'method': method, 'participants': participants, 'values': values or []}
