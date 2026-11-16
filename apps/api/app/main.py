import time
from functools import lru_cache
from io import BytesIO
from typing import Callable
from uuid import uuid4

import numpy as np
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from PIL import Image, UnidentifiedImageError

from app.engines.base import OCREngine
from app.engines.paddle_engine import PaddleOCREngine

MAX_UPLOAD_BYTES = 12 * 1024 * 1024
MAX_IMAGE_PIXELS = 25_000_000
SUPPORTED_FORMATS = {"PNG", "JPEG", "WEBP"}

app = FastAPI(title="Image to Text API", version="0.1.0")


@lru_cache(maxsize=1)
def get_engine() -> OCREngine:
    return PaddleOCREngine()


def get_engine_factory() -> Callable[[], OCREngine]:
    return get_engine


@app.get("/api/v1/health")
@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/ocr")
async def recognize_image(
    file: UploadFile = File(...),
    language: str = Form("en"),
    engine_factory: Callable[[], OCREngine] = Depends(get_engine_factory),
) -> dict:
    if language != "en":
        raise HTTPException(status_code=422, detail="Only English is enabled in this prototype.")

    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds the 12 MB limit.")

    try:
        with Image.open(BytesIO(contents)) as source:
            if source.format not in SUPPORTED_FORMATS:
                raise HTTPException(status_code=415, detail="Use a PNG, JPEG, or WebP image.")
            if source.width * source.height > MAX_IMAGE_PIXELS:
                raise HTTPException(status_code=413, detail="Image exceeds the 25 megapixel limit.")
            image = np.asarray(source.convert("RGB"))
    except UnidentifiedImageError as error:
        raise HTTPException(status_code=415, detail="The uploaded file is not a supported image.") from error

    started_at = time.perf_counter()
    try:
        engine = engine_factory()
        blocks = await run_in_threadpool(engine.extract, image, language)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    elapsed_ms = round((time.perf_counter() - started_at) * 1000)
    recognized_text = "\n".join(block["text"] for block in blocks)
    scores = [block["confidence"] for block in blocks if block["confidence"] is not None]
    average_confidence = sum(scores) / len(scores) if scores else None

    return {
        "document_id": f"doc_{uuid4().hex[:12]}",
        "status": "completed",
        "language": [language],
        "engine": {
            "name": engine.name,
            "model": engine.model,
            "version": engine.version,
        },
        "pages": [
            {
                "page_number": 1,
                "text": recognized_text,
                "blocks": blocks,
                "tables": [],
                "average_confidence": average_confidence,
            }
        ],
        "metadata": {
            "processing_time_ms": elapsed_ms,
            "total_pages": 1,
            "needs_review": average_confidence is None or average_confidence < 0.75,
        },
    }