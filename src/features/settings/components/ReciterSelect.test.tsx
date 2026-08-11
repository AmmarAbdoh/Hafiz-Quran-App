// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { LocaleProvider } from "@/app/i18n";
import { DEFAULT_RECITER_ID } from "@/domain/quran";
import { ReciterSelect } from "./ReciterSelect";

describe("ReciterSelect", () => {
  it("supports searching and choosing a reciter with the keyboard", () => {
    const onValueChange = vi.fn();
    render(
      <LocaleProvider>
        <ReciterSelect
          value={DEFAULT_RECITER_ID}
          onValueChange={onValueChange}
        />
      </LocaleProvider>,
    );

    const input = screen.getByRole("combobox");
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: "Sudais" } });

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /عبد الرحمن السديس/ }),
    ).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onValueChange).toHaveBeenCalledWith(
      "ea-Abdurrahmaan_As-Sudais_192kbps",
    );
    expect(input).toHaveFocus();
  });
});
