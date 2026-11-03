import pytest

from app.core.config import CLIENT_HEADER

ALLOWED = 'http://localhost:8081'


class TestCors:
    @pytest.fixture(autouse=True)
    def setup(self, client) -> None:
        self.client = client

    def preflight(self, origin: str, method='PATCH'):
        return self.client.options('/v1/me', headers={
            'Origin': origin, 'Access-Control-Request-Method': method,
            'Access-Control-Request-Headers': f'content-type,{CLIENT_HEADER.lower()}'})

    def test_the_apps_web_origin_may_send_cookies_and_the_client_header(self):
        response = self.preflight(ALLOWED)

        assert response.status_code == 200
        assert response.headers['access-control-allow-origin'] == ALLOWED
        assert response.headers['access-control-allow-credentials'] == 'true'
        assert CLIENT_HEADER.lower() in response.headers['access-control-allow-headers'].lower()

    def test_another_site_is_refused(self):
        response = self.preflight('https://evil.example')

        assert response.status_code == 400
        assert 'access-control-allow-origin' not in response.headers

    def test_a_response_to_an_allowed_origin_names_it_and_allows_credentials(self):
        response = self.client.get('/healthz', headers={'Origin': ALLOWED})

        assert response.headers['access-control-allow-origin'] == ALLOWED
        assert response.headers['access-control-allow-credentials'] == 'true'
