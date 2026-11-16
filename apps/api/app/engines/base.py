from typing import Protocol

import numpy as np


class OCREngine(Protocol):
    name: str
    model: str
    version: str

    def extract(self, image: np.ndarray, language: str) -> list[dict]: ...