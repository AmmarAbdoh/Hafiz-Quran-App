// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { quranRepository } from "@/domain/quran";
import { MushafReaderProvider } from "@/features/quran-reader";
import { AppProviders } from "@/app/providers";
import { AppRoutes } from "@/app/routes";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function renderRoute(pathname: string) {
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  );

  return screen.findByRole("heading", { level: 1 }, { timeout: 5_000 });
}

describe("application route boundaries", () => {
  it.each(["/", "/settings"])(
    "does not load Quran data on %s",
    async (pathname) => {
      const loadCoreData = vi.spyOn(quranRepository, "loadCoreData");

      await renderRoute(pathname);

      expect(loadCoreData).not.toHaveBeenCalled();
    },
  );

  it("renders the localized not-found route", async () => {
    await renderRoute("/this-route-does-not-exist");

    expect(
      screen.getByRole("link", { name: /(?:home|الرئيسية)/i }),
    ).toHaveAttribute("href", "/");
  });

  it("offers a localized retry when reader data cannot be loaded", async () => {
    quranRepository.clearCache();
    const loadCoreData = vi
      .spyOn(quranRepository, "loadCoreData")
      .mockRejectedValue(new Error("offline"));
    vi.spyOn(quranRepository, "loadPageLayout").mockRejectedValue(
      new Error("offline"),
    );

    render(
      <MemoryRouter initialEntries={["/quran/page/1"]}>
        <AppProviders>
          <MushafReaderProvider>
            <AppRoutes />
          </MushafReaderProvider>
        </AppProviders>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("alert", undefined, { timeout: 5_000 }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: /(?:try again|إعادة المحاولة)/i,
      }),
    );
    await waitFor(() => expect(loadCoreData).toHaveBeenCalledTimes(2));
  });
});
