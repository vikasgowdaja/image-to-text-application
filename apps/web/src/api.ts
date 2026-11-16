export type OCRBlock = {
  id: string;
  text: string;
  type: string;
  confidence: number | null;
  raw_engine_score: number | null;
  confidence_calibrated: boolean;
  language: string;
  bbox: number[];
};

export type OCRResponse = {
  document_id: string;
  status: string;
  language: string[];
  engine: { name: string; model: string; version: string };
  pages: Array<{
    page_number: number;
    text: string;
    blocks: OCRBlock[];
    tables: unknown[];
    average_confidence: number | null;
  }>;
  metadata: {
    processing_time_ms: number;
    total_pages: number;
    needs_review: boolean;
  };
};

export type ParsedQuestion = {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
};

export async function recognizeImage(file: File): Promise<OCRResponse> {
  const body = new FormData();
  body.append("file", file);
  body.append("language", "en");

  const response = await fetch("/api/v1/ocr", { method: "POST", body });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string }; detail?: string }
      | null;
    throw new Error(
      payload?.error?.message ?? payload?.detail ?? "Could not process this image.",
    );
  }

  return (await response.json()) as OCRResponse;
}