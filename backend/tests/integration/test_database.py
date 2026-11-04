from sqlalchemy import text


class TestDatabase:
    def test_connects_and_stays_inside_the_test_schema(self, database, test_schema):
        with database.transaction() as connection:
            assert connection.execute(text('SELECT current_schema()')).scalar() == test_schema
        database.ping()
