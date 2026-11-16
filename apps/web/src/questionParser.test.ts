import { describe, expect, it } from "vitest";
import { parseQuestion } from "./questionParser";

describe("parseQuestion", () => {
  it("parses a question and labeled options while leaving the answer blank", () => {
    expect(
      parseQuestion(
        "Question: Which planet is known as the Red Planet?\nA) Earth\nB) Mars\nC) Venus\nD) Jupiter",
      ),
    ).toEqual({
      question: "Which planet is known as the Red Planet?",
      optionA: "Earth",
      optionB: "Mars",
      optionC: "Venus",
      optionD: "Jupiter",
      correctAnswer: "",
    });
  });

  it("joins wrapped option lines and preserves unstructured text as the question", () => {
    expect(parseQuestion("Choose one\nA. first line\ncontinued line")).toMatchObject({
      question: "Choose one",
      optionA: "first line continued line",
      optionB: "",
      correctAnswer: "",
    });
  });

  it("does not put a printed answer key into an option or answer cell", () => {
    expect(parseQuestion("Pick one\nA) First\nB) Second\nAnswer: B")).toMatchObject({
      question: "Pick one",
      optionA: "First",
      optionB: "Second",
      correctAnswer: "",
    });
  });
});