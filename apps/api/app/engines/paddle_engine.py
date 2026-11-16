from importlib.metadata import PackageNotFoundError, version

import numpy as np


class PaddleOCREngine:
    name = "paddleocr"
    model = "PP-OCRv6-medium"

    def __init__(self) -> None:
        try:
            from paddleocr import PaddleOCR
        except ImportError as error:
            raise RuntimeError(
                "PaddleOCR is not installed. Install the API with the [ocr] extra."
            ) from error

        try:
            self._ocr = PaddleOCR(
                lang="en",
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
                enable_mkldnn=False,
            )
            self.version = version("paddleocr")
        except (ImportError, PackageNotFoundError) as error:
            raise RuntimeError("PaddleOCR could not be initialized.") from error

    def extract(self, image: np.ndarray, language: str) -> list[dict]:
        if language != "en":
            raise ValueError(f"Language '{language}' is not supported by this prototype.")

        blocks: list[dict] = []
        for page_result in self._ocr.predict(image):
            payload = getattr(page_result, "json", page_result)
            if callable(payload):
                payload = payload()
            if isinstance(payload, dict) and "res" in payload:
                payload = payload["res"]
            if not isinstance(payload, dict):
                continue

            texts = payload.get("rec_texts", [])
            scores = payload.get("rec_scores", [])
            polygons = payload.get("rec_polys", payload.get("dt_polys", []))
            for index, recognized_text in enumerate(texts):
                score = float(scores[index]) if index < len(scores) else None
                polygon = polygons[index] if index < len(polygons) else []
                points = np.asarray(polygon, dtype=float).reshape(-1, 2) if len(polygon) else np.empty((0, 2))
                bbox = (
                    [
                        float(points[:, 0].min()),
                        float(points[:, 1].min()),
                        float(points[:, 0].max()),
                        float(points[:, 1].max()),
                    ]
                    if len(points)
                    else []
                )
                blocks.append(
                    {
                        "id": f"block_{index + 1:03}",
                        "text": str(recognized_text),
                        "type": "text",
                        "confidence": score,
                        "raw_engine_score": score,
                        "confidence_calibrated": False,
                        "language": language,
                        "bbox": bbox,
                    }
                )
        return blocks