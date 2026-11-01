import { describe, expect, it } from "vitest";
import { encodeWav, toPcm16 } from "./wav";

describe("a recitation as a wav file", () => {
  it("joins the blocks in order behind a 16-bit mono header", () => {
    const bytes = encodeWav(
      [new Int16Array([1, -2]), new Int16Array([3])],
      16_000,
    );
    const view = new DataView(bytes.buffer);

    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe("RIFF");
    expect(view.getUint32(4, true)).toBe(36 + 6);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(6);
    expect([0, 1, 2].map((i) => view.getInt16(44 + i * 2, true))).toEqual([
      1, -2, 3,
    ]);
  });

  /* A sample past ±1 would wrap to the opposite sign: a click. */
  it("clamps a float sample louder than the format holds", () => {
    expect([...toPcm16(new Float32Array([0, 0.5, 2, -2]))]).toEqual([
      0, 16384, 32767, -32767,
    ]);
  });
});
