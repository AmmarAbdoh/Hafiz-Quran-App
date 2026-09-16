// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./SegmentedControl";

const OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function renderControl(value = "light", dir: "rtl" | "ltr" = "ltr") {
  const onValueChange = vi.fn();
  const { container } = render(
    <div dir={dir}>
      <SegmentedControl
        aria-label="Appearance"
        value={value}
        options={OPTIONS}
        onValueChange={onValueChange}
      />
    </div>,
  );
  // jsdom does not resolve `direction` from a dir attribute on its own.
  const tablist = container.querySelector<HTMLElement>("[role='tablist']");
  tablist!.style.direction = dir;
  return { onValueChange, cleanup };
}

function pressOn(name: string, key: string) {
  fireEvent.keyDown(screen.getByRole("tab", { name }), { key });
}

describe("SegmentedControl", () => {
  it("is a single tab stop with a roving focus", () => {
    renderControl("dark");

    expect(screen.getByRole("tab", { name: "Dark" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("tab", { name: "Light" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  /*
   * The roving tabindex was there from the start and the arrow keys were not,
   * so every unselected option was unreachable: Tab skipped them for their
   * tabindex of -1 and nothing moved the focus. On the settings page that left
   * neither language nor appearance changeable without a mouse.
   */
  it("moves to the next option on ArrowRight", () => {
    const { onValueChange } = renderControl("light");
    pressOn("Light", "ArrowRight");
    expect(onValueChange).toHaveBeenCalledWith("dark");
  });

  it("moves to the previous option on ArrowLeft", () => {
    const { onValueChange } = renderControl("dark");
    pressOn("Dark", "ArrowLeft");
    expect(onValueChange).toHaveBeenCalledWith("light");
  });

  it("wraps at both ends", () => {
    const last = renderControl("system");
    pressOn("System", "ArrowRight");
    expect(last.onValueChange).toHaveBeenCalledWith("light");
    last.cleanup();

    const first = renderControl("light");
    pressOn("Light", "ArrowLeft");
    expect(first.onValueChange).toHaveBeenCalledWith("system");
  });

  it("jumps to the ends with Home and End", () => {
    const { onValueChange } = renderControl("dark");

    pressOn("Dark", "Home");
    expect(onValueChange).toHaveBeenCalledWith("light");

    pressOn("Dark", "End");
    expect(onValueChange).toHaveBeenCalledWith("system");
  });

  it("uses the vertical arrows whichever way the text runs", () => {
    const { onValueChange } = renderControl("light");
    pressOn("Light", "ArrowDown");
    expect(onValueChange).toHaveBeenCalledWith("dark");
  });

  /*
   * The arrows follow what the reader sees, not the array order, so in Arabic
   * the left arrow moves to the option drawn to the left - which is the next
   * one along.
   */
  it("swaps the horizontal arrows under RTL", () => {
    const { onValueChange } = renderControl("light", "rtl");

    pressOn("Light", "ArrowLeft");
    expect(onValueChange).toHaveBeenCalledWith("dark");

    pressOn("Light", "ArrowRight");
    expect(onValueChange).toHaveBeenCalledWith("system");
  });

  it("leaves other keys to the page", () => {
    const { onValueChange } = renderControl("light");
    pressOn("Light", "Tab");
    pressOn("Light", "a");
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
