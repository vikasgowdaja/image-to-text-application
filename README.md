# Image to Text

Phase 1 prototype for the image-to-text architecture: select or drop a batch of question photos, process them one at a time with PaddleOCR, review the extracted question and options, then export one spreadsheet row per photo.

## Prerequisites

- Node.js 22 and Corepack
- Python 3.11-3.13

## Run locally

From the repository root, install the frontend dependencies:

```powershell
corepack pnpm install
```

Install and start the API in a second terminal:

```powershell
cd apps/api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev,ocr]"
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Start the web app from the repository root:

```powershell
corepack pnpm dev
```

Open the URL printed by Vite. Select up to 500 PNG, JPEG, or WebP images (12 MB each). OCR model files are downloaded by PaddleOCR on first use; the initial request may take longer. The queue runs sequentially and continues if an individual image fails. Review the parsed question and A-D option cells before exporting `question-extraction.xlsx`.

## Checks

```powershell
corepack pnpm build
corepack pnpm --filter @image-to-text/web test
cd apps/api
python -m pip install -e ".[dev]"
python -m pytest
```

## Scope

The prototype accepts PNG, JPEG, and WebP images up to 12 MB and 25 megapixels. It uses PaddleOCR's English recognition route and returns a normalized single-page result. The browser parses labeled A-D options heuristically; extracted cells are editable, and the correct-answer column is intentionally left blank. Each photo is treated as one question. The API processes images in memory and does not persist documents or results.

Authentication, tenant isolation, database-backed document history, asynchronous jobs, PDF support, other language routes, alternate OCR engines, cloud processing, desktop packaging, and production deployment are not implemented yet. Do not use this prototype with sensitive documents; it has no authentication or retention controls.