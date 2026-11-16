import type { ParsedQuestion } from "./api";

const OPTION_FIELDS = {
  A: "optionA",
  B: "optionB",
  C: "optionC",
  D: "optionD",
} as const;

export function parseQuestion(text: string): ParsedQuestion {
  const parsed: ParsedQuestion = {
    question: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctAnswer: "",
  };
  const questionLines: string[] = [];
  let activeOption: keyof typeof OPTION_FIELDS | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^(?:correct\s+)?answer\s*[:.-]/i.test(line)) {
      activeOption = null;
      continue;
    }

    const optionMatch = line.match(/^\s*(?:\(([A-D])\)|([A-D]))[\s).:\-]+(.*)$/i);
    const optionLabel = (optionMatch?.[1] ?? optionMatch?.[2])?.toUpperCase() as
      | keyof typeof OPTION_FIELDS
      | undefined;

    if (optionMatch && optionLabel) {
      activeOption = optionLabel;
      parsed[OPTION_FIELDS[optionLabel]] = optionMatch[3].trim();
      continue;
    }

    if (activeOption) {
      const field = OPTION_FIELDS[activeOption];
      parsed[field] = `${parsed[field]} ${line}`.trim();
    } else {
      questionLines.push(line.replace(/^question\s*[:.-]\s*/i, ""));
    }
  }

  parsed.question = questionLines.join(" ").trim();
  return parsed;
}