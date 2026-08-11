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
  MushafFontLoadingState: ({ message }: { message: string }) => (
    <div role="status">{message}</div>
  ),
  MushafPageView: (props: {
    pageLayout: { page: number };
    onWordActivate?: unknown;
  }) => (
    <div
      data-testid="mushaf-page"
      data-page={props.pageLayout.page}
      data-interactive={String(props.onWordActivate !== undefined)}
    />
  ),
}));

vi.mock("@/shared/hooks/use-theme", () => ({
  useTheme: () => ({ theme: "light" }),
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
});
