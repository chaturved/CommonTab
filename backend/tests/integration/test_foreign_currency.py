from helpers import client_for, create_group, headers, m, register


def foreign(group, payer, **changes):
    record = {'id': '5' * 8 + '-0000-4000-8000-000000000001', 'merchant': 'Hotel', 'occurredAt': '2026-09-30T12:00:00Z',
              'category': 'travel', 'notes': '', 'amountMinor': 12960, 'payerID': payer, 'method': 'equal',
              'participants': [payer], 'currencyCode': 'EUR', 'originalMinor': 12000, 'rateMicros': 1_080_000}
    return {**record, **changes}


class TestForeignCurrency:
    def test_the_original_amount_and_rate_are_kept_and_balances_use_the_converted_amount(self, database):
        api = client_for(database)
        ada = register(api, 'ada@example.com', 'Ada')
        group = create_group(api, ada)
        record = foreign(group, m(ada, group))

        saved = api.put(f"/v1/groups/{group['id']}/expenses/{record['id']}", headers=headers(ada), json=record)

        assert saved.status_code == 200
        body = saved.json()
        assert (body['amountMinor'], body['currencyCode'], body['originalMinor'], body['rateMicros']) == (12960, 'EUR', 12000, 1_080_000)
        snapshot = api.get(f"/v1/groups/{group['id']}", headers=headers(ada)).json()
        assert snapshot['expenses'][0]['rateMicros'] == 1_080_000

    def test_an_amount_that_disagrees_with_the_rate_is_refused(self, database):
        api = client_for(database)
        ada = register(api, 'ada@example.com', 'Ada')
        group = create_group(api, ada)
        record = foreign(group, m(ada, group), amountMinor=13000)

        refused = api.put(f"/v1/groups/{group['id']}/expenses/{record['id']}", headers=headers(ada), json=record)

        assert refused.status_code == 422
        assert refused.json()['code'] == 'conversion_mismatch' and refused.json()['expectedAmountMinor'] == 12960

    def test_an_ordinary_expense_has_no_foreign_fields_and_a_changed_rate_is_an_edit(self, database):
        api = client_for(database)
        ada = register(api, 'ada@example.com', 'Ada')
        group = create_group(api, ada)
        record = foreign(group, m(ada, group))
        url = f"/v1/groups/{group['id']}/expenses/{record['id']}"
        first = api.put(url, headers=headers(ada), json=record).json()

        again = api.put(url, headers=headers(ada), json=record).json()
        edited = api.put(url, headers=headers(ada), json={**record, 'rateMicros': 1_100_000, 'amountMinor': 13200, 'version': first['version']}).json()

        assert again['version'] == first['version']
        assert (edited['version'], edited['rateMicros'], edited['amountMinor']) == (first['version'] + 1, 1_100_000, 13200)
