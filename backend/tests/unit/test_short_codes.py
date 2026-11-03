import pytest

from app.domain.short_codes import ALPHABET, CODE_LENGTH, display_code, new_code, normalize_code


class TestInviteCodes:
    def test_a_new_code_has_eight_characters_from_the_alphabet(self):
        code = new_code()

        assert len(code) == CODE_LENGTH == 8 and set(code) <= set(ALPHABET)

    def test_new_codes_differ(self):
        assert len({new_code() for _ in range(50)}) == 50

    def test_the_alphabet_has_no_lookalike_letters(self):
        assert not set('ILOU') & set(ALPHABET) and len(set(ALPHABET)) == 32

    def test_a_code_is_shown_in_two_groups_of_four(self):
        assert display_code('ABCD2345') == 'ABCD-2345'

    @pytest.mark.parametrize('typed', ['abcd-2345', 'ABCD 2345', ' abcd2345 ', 'ABCD-2345\n'])
    def test_typed_codes_are_forgiven_for_case_dashes_and_spaces(self, typed):
        assert normalize_code(typed) == 'ABCD2345'

    def test_look_alike_letters_are_read_as_the_digits_they_resemble(self):
        assert normalize_code('OIlO-1234') == '01101234'

    @pytest.mark.parametrize('typed', ['', 'ABC', 'ABCD-23456', 'ABCD-234!', 'ABCD-234U'])
    def test_anything_that_cannot_be_a_code_is_none(self, typed):
        assert normalize_code(typed) is None
