from io import BytesIO

import pytest
from PIL import Image

from app.core.errors import APIError
from app.services.receipt_images import ReceiptImageProcessor


def image_bytes(fmt: str, size=(40, 30), mode='RGB') -> bytes:
    output = BytesIO()
    Image.new(mode, size, 'white').save(output, format=fmt)
    return output.getvalue()


class TestReceiptImageProcessor:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.processor = ReceiptImageProcessor()

    def test_a_png_with_transparency_becomes_a_jpeg(self):
        result = self.processor.normalize(image_bytes('PNG', mode='RGBA'), 'image/png')

        assert Image.open(BytesIO(result)).format == 'JPEG'

    def test_a_jpeg_stays_a_jpeg(self):
        result = self.processor.normalize(image_bytes('JPEG'), 'image/jpeg')

        assert result.startswith(b'\xff\xd8\xff')

    def test_large_images_are_scaled_down_to_1800_pixels(self):
        result = self.processor.normalize(image_bytes('JPEG', size=(3000, 2000)), 'image/jpeg')

        assert max(Image.open(BytesIO(result)).size) == 1800

    def test_content_that_does_not_match_the_declared_type_is_rejected(self):
        with pytest.raises(APIError) as caught:
            self.processor.normalize(image_bytes('PNG'), 'image/jpeg')

        assert caught.value.status == 422

    def test_bytes_that_are_not_an_image_are_rejected(self):
        with pytest.raises(APIError) as caught:
            self.processor.normalize(b'not an image', 'image/png')

        assert caught.value.status == 422

    def test_an_image_with_too_many_pixels_is_rejected(self):
        with pytest.raises(APIError) as caught:
            self.processor.normalize(image_bytes('PNG', size=(5000, 5000), mode='L'), 'image/png')

        assert caught.value.status == 422
