from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api.deps import current_user
from app.core.config import Settings, get_settings
from app.core.ratelimit import RateLimiters, get_rate_limiters
from app.main import app

USER_ID = '11111111-1111-1111-1111-111111111111'


@pytest.fixture(autouse=True)
def overrides():
    settings = Settings(database_url='')
    limiters = RateLimiters(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[current_user] = lambda: USER_ID
    app.dependency_overrides[get_rate_limiters] = lambda: limiters
    yield app.dependency_overrides
    app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
