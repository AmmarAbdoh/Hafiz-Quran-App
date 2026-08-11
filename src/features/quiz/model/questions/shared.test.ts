import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ayahSnippet,
  buildChoices,
  createQuestionId,
  splitAyahForCompletion,
} from "./shared";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("question helpers", () => {
  it("creates a time-based question identifier", () => {
    vi.spyOn(Date, "now").mockReturnValue(1234);
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    expect(createQuestionId()).toMatch(/^1234-[a-z0-9]{1,8}$/);
  });

  it("keeps the correct choice and deduplicates distractors", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const choices = buildChoices({ id: "correct", label: "Correct" }, [
      { id: "correct", label: "Duplicate" },
      { id: "a", label: "A" },
      { id: "a", label: "Duplicate A" },
      { id: "b", label: "B" },
      { id: "c", label: "C" },
      { id: "d", label: "D" },
    ]);

    expect(choices).toHaveLength(4);
    expect(choices.filter(({ id }) => id === "correct")).toEqual([
      { id: "correct", label: "Correct" },
    ]);
    expect(new Set(choices.map(({ id }) => id)).size).toBe(4);
  });

  it("can return fewer choices when unique distractors are unavailable", () => {
    expect(
      buildChoices(
        { id: "correct", label: "Correct" },
        [{ id: "correct", label: "Duplicate" }],
        2,
      ),
    ).toEqual([{ id: "correct", label: "Correct" }]);
  });

  it("splits short and long ayahs without dropping their continuation", () => {
    expect(splitAyahForCompletion("")).toEqual({
      prompt: "",
      continuation: "",
    });
    expect(splitAyahForCompletion("one")).toEqual({
      prompt: "one",
      continuation: "one",
    });
    expect(splitAyahForCompletion("one two")).toEqual({
      prompt: "one",
      continuation: "two",
    });
    expect(splitAyahForCompletion("one two three four five")).toEqual({
      prompt: "one two",
      continuation: "three four five",
    });
  });

  it("returns a trimmed snippet and marks only truncated text", () => {
    expect(ayahSnippet("  one two  ")).toBe("one two");
    expect(ayahSnippet("one two three", 3)).toBe("one two three");
    expect(ayahSnippet("one two three four", 3)).toBe("one two three …");
  });
});
