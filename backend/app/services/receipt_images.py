from __future__ import annotations

from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.errors import fail


class ReceiptImageProcessor:
    def normalize(self, data: bytes, mime: str) -> bytes:
        try:
            with Image.open(BytesIO(data)) as image:
                expected_format = 'JPEG' if mime == 'image/jpeg' else 'PNG'
                if image.format != expected_format or image.width * image.height > 20_000_000:
                    fail(422, 'Receipt image is invalid or too large')
                image = ImageOps.exif_transpose(image)
                image.thumbnail((1800, 1800))
                if image.mode != 'RGB':
                    rgb = Image.new('RGB', image.size, 'white')
                    if image.mode in ('RGBA', 'LA'):
                        rgb.paste(image, mask=image.getchannel('A'))
                    else:
                        rgb.paste(image.convert('RGB'))
                    image = rgb
                output = BytesIO()
                image.save(output, format='JPEG', quality=80, optimize=True)
                return output.getvalue()
        except (UnidentifiedImageError, OSError, ValueError):
            fail(422, 'Receipt image could not be decoded')
