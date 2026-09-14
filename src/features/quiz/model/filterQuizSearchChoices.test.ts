import { describe, expect, it } from "vitest";
import { filterQuizSearchChoices } from "./filterQuizSearchChoices";
import type { QuizChoice } from "./types";

function choice(id: string, label: string): QuizChoice {
  return { id, label };
}

describe("filterQuizSearchChoices", () => {
  const choices = [
    choice("1:1", "بسم الله الرحمن الرحيم"),
    choice("1:2", "الحمد لله رب العالمين"),
    choice("1:3", "الرحمن الرحيم"),
    choice("1:4", "مالك يوم الدين"),
    choice("1:5", "إياك نعبد وإياك نستعين"),
    choice("1:6", "اهدنا الصراط المستقيم"),
    choice("1:7", "صراط الذين أنعمت عليهم"),
    choice("2:1", "الم"),
    choice("2:2", "ذلك الكتاب لا ريب فيه"),
    choice("112:1", "قل هو الله أحد"),
  ];

  it("returns every choice when the query is empty", () => {
    expect(filterQuizSearchChoices(choices, "")).toHaveLength(choices.length);
  });

  it("ranks prefix matches ahead of substring matches", () => {
    const filtered = filterQuizSearchChoices(choices, "الحمد");
    expect(filtered[0]?.id).toBe("1:2");
  });

  it("always keeps the required choice visible after truncation", () => {
    const filtered = filterQuizSearchChoices(choices, "ال", "112:1");
    expect(filtered.some((item) => item.id === "112:1")).toBe(true);
    expect(filtered.length).toBeLessThanOrEqual(8);
  });
});
