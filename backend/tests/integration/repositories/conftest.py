import pytest


@pytest.fixture
def connection(database):
    with database.transaction() as connection:
        yield connection
