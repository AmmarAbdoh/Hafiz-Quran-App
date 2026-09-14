// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { QuizMushafPreview } from "./QuizMushafPreview";

const mocks = vi.hoisted(() => ({
  loadPageLayout: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/domain/quran", () => ({
  useQuranData: () => ({ loadPageLayout: mocks.loadPageLayout }),
  MushafPageSkeleton: ({ label }: { label: string }) => (
    <div role="status">{label}</div>
  ),
  MushafPageView: (props: {
    pageLayout: { page: number };
    practiceMode?: boolean;
    hidePracticeWords?: boolean;
    onWordActivate?: unknown;
  }) => (
    <div
      data-testid="mushaf-page"
      data-page={props.pageLayout.page}
      data-practice-mode={String(Boolean(props.practiceMode))}
      data-hide-practice-words={String(Boolean(props.hidePracticeWords))}
      data-interactive={String(props.onWordActivate !== undefined)}
    />
  ),
}));

vi.mock("@/shared/hooks/use-theme", () => ({
  useTheme: () => ({ theme: "light" }),
}));

vi.mock("@/features/quran-reader/hooks/useTajweedColored", () => ({
  useTajweedColored: () => ({
    tajweedColored: false,
    setTajweedColored: vi.fn(),
  }),
}));

describe("QuizMushafPreview", () => {
  it("loads one page layout and renders it as a passive Mushaf", async () => {
    mocks.loadPageLayout.mockResolvedValue({ page: 42, lines: [] });

    render(<QuizMushafPreview page={42} mushafData={[]} />);

    await waitFor(() => expect(mocks.loadPageLayout).toHaveBeenCalledWith(42));
    const page = await screen.findByTestId("mushaf-page");
    expect(page).toHaveAttribute("data-page", "42");
    expect(page).toHaveAttribute("data-interactive", "false");
  });

  it("enables practice mode when a verse is hidden", async () => {
    mocks.loadPageLayout.mockResolvedValue({ page: 42, lines: [] });

    render(
      <QuizMushafPreview page={42} mushafData={[]} hiddenVerseKey="112:2" />,
    );

    const page = await screen.findByTestId("mushaf-page");
    expect(page).toHaveAttribute("data-practice-mode", "true");
    expect(page).toHaveAttribute("data-hide-practice-words", "true");
  });
});
