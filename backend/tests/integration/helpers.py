"""Shared helpers for the HTTP tests."""
from dataclasses import replace
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.deps import get_database, get_rate_limiters, get_settings
from app.core.config import Settings
from app.core.ratelimit import RateLimiters
from app.main import app


def client_for(database, **settings) -> TestClient:
    """The real app wired to the test database (and to Settings with the given changes) through dependency overrides."""
    configured = replace(Settings(database_url=''), **settings)
    app.dependency_overrides[get_database] = lambda: database
    app.dependency_overrides[get_settings] = lambda: configured
    limiters = RateLimiters(configured)
    app.dependency_overrides[get_rate_limiters] = lambda: limiters
    return TestClient(app)


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
    group = response.json()
    account.setdefault('members', {})[group['id']] = group['meMemberID']
    return group


def m(account, group):
    """The account's member id in this group (members, not accounts, own expenses and payments)."""
    return account['members'][group['id']]


def join(client, group, inviter, invitee):
    invitation = client.post(f"/v1/groups/{group['id']}/invitations", headers=headers(inviter),
                             json={'email': invitee['user']['email']})
    assert invitation.status_code == 201, invitation.text
    token = invitation.json()['inviteToken']
    accepted = client.post('/v1/invitations/accept', headers=headers(invitee), json={'inviteToken': token})
    assert accepted.status_code == 200, accepted.text
    invitee.setdefault('members', {})[group['id']] = accepted.json()['meMemberID']
    assert client.post('/v1/invitations/accept', headers=headers(invitee),
                       json={'inviteToken': token}).status_code == 404


def expense(group, payer, participants, method='equal', values=None, amount=10001):
    return {'id': str(uuid4()), 'merchant': 'Groceries', 'occurredAt': '2026-09-30T12:00:00Z',
            'category': 'groceries', 'notes': '', 'amountMinor': amount, 'payerID': payer,
            'method': method, 'participants': participants, 'values': values or []}
