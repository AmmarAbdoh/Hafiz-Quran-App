export async function copyVerseText(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function shareVerseText(
  text: string,
  title: string,
): Promise<"shared" | "copied" | "failed"> {
  if (!text) return "failed";

  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "failed";
      }
    }
  }

  return (await copyVerseText(text)) ? "copied" : "failed";
}
