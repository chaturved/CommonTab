from typing import Literal

from pydantic import BaseModel


class ProductEvent(BaseModel):
    name: Literal['calculator_opened', 'scan_opened', 'scan_completed', 'itemized_opened', 'share_created']
    variant: Literal['A', 'B']
