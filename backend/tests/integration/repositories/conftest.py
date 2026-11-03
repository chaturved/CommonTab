import pytest


@pytest.fixture
def connection(database):
    """One connection in one transaction, committed when the test ends (the `database` fixture empties the tables)."""
    with database.transaction() as connection:
        yield connection
