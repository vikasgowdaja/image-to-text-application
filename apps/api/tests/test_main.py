from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app, get_engine_factory


class FakeEngine:
    name = "test-engine"
    model = "fixture"
    version = "1.0"

    def extract(self, image, language):
        assert image.shape == (8, 12, 3)
        assert language == "en"
        return [
            {
                "id": "block_001",
                "text": "Hello document",
                "type": "text",
                "confidence": 0.91,
                "raw_engine_score": 0.91,
                "confidence_calibrated": False,
                "language": "en",
                "bbox": [1.0, 2.0, 10.0, 7.0],
            }
        ]


def png_image() -> bytes:
    image = Image.new("RGB", (12, 8), "white")
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def test_ocr_returns_normalized_result() -> None:
    app.dependency_overrides[get_engine_factory] = lambda: FakeEngine
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/ocr",
                files={"file": ("sample.png", png_image(), "image/png")},
                data={"language": "en"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "completed"
    assert result["pages"][0]["text"] == "Hello document"
    assert result["pages"][0]["blocks"][0]["raw_engine_score"] == 0.91
    assert result["engine"]["name"] == "test-engine"


def test_ocr_rejects_non_image_upload() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/ocr",
            files={"file": ("sample.txt", b"not an image", "text/plain")},
            data={"language": "en"},
        )

    assert response.status_code == 415


def test_health_route() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}