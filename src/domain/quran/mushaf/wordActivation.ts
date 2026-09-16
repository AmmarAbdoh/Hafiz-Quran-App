import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";
import type { MushafWord } from "../model";

/**
 * How a word or verse came to be activated.
 *
 * A pointer activation carries coordinates, which the reader uses to work out
 * which glyph was actually under the finger - the glyphs are laid out tightly
 * enough that the element receiving the event is not always the one touched. A
 * keyboard activation has no coordinates and acts on whatever held focus,
 * which is the whole ayah.
 */
export type MushafActivationEvent =
  | MouseEvent<HTMLElement>
  | KeyboardEvent<HTMLElement>;

export type MushafWordActivateHandler = (
  word: MushafWord,
  event: MushafActivationEvent,
) => void;

/**
 * Glyphs are spans rather than buttons - they are hidden from assistive
 * technology and exist only to catch pointer events - so these handlers are
 * typed to the element, not to a control.
 */
export type MushafWordPointerHandler = (
  word: MushafWord,
  event: PointerEvent<HTMLElement>,
) => void;
