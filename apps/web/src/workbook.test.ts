import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildQuestionWorkbook } from "./workbook";

describe("buildQuestionWorkbook", () => {
  it("writes one row per image and leaves the correct-answer column blank", async () => {
    const data = await buildQuestionWorkbook([
      {
        image: "question-01.png",
        question: {
          question: "Which planet is red?",
          optionA: "Earth",
          optionB: "Mars",
          optionC: "Venus",
          optionD: "Jupiter",
          correctAnswer: "",
        },
      },
    ]);
    const workbook = XLSX.read(data, { type: "array" });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Questions!, { header: 1 });

    expect(rows).toEqual([
      ["Image", "Question", "Option A", "Option B", "Option C", "Option D", "Correct Answer"],
      ["question-01.png", "Which planet is red?", "Earth", "Mars", "Venus", "Jupiter", ""],
    ]);
  });
});