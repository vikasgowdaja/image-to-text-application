import type { ParsedQuestion } from "./api";

export type WorkbookQuestion = {
  image: string;
  question: ParsedQuestion;
};

export async function buildQuestionWorkbook(rows: WorkbookQuestion[]): Promise<ArrayBuffer> {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Image", "Question", "Option A", "Option B", "Option C", "Option D", "Correct Answer"],
    ...rows.map(({ image, question }) => [
      image,
      question.question,
      question.optionA,
      question.optionB,
      question.optionC,
      question.optionD,
      question.correctAnswer,
    ]),
  ]);
  worksheet["!cols"] = [
    { wch: 30 }, { wch: 52 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 20 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Questions");
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}