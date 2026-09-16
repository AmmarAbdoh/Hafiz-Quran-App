import { describe, expect, it } from "vitest";
import { buildListenSession } from "@/features/quran-reader/model/listenPlan";
import type { MushafVerse } from "@/domain/quran";

function makeVerse(surah: number, ayah: number): MushafVerse {
  return {
    id: surah * 1000 + ayah,
    jozz: 1,
    page: 1,
    sura_no: surah,
    sura_name_en: "Al-Ikhlas",
    sura_name_ar: "الإخلاص",
    line_start: 1,
    line_end: 1,
    aya_no: ayah,
    aya_text: "آية",
    aya_text_emlaey: "اية",
  };
}

const mushafData = [1, 2, 3, 4].map((ayah) => makeVerse(112, ayah));

/*
 * The verse actions used to offer "listen to this ayah", which played from
 * that ayah to the end of the surah, and no way at all to repeat one ayah -
 * the thing memorizing actually consists of. Repeating meant leaving the
 * ayah, opening a dialog and typing back the surah and ayah already chosen.
 */
describe("repeating a single ayah", () => {
  it("plays that ayah and nothing after it", () => {
    const session = buildListenSession(
      {
        scope: "ayah",
        surah: 112,
        ayah: 2,
        repeatMode: "count",
        repeatCount: 10,
      },
      mushafData,
    );

    expect(session).not.toBeNull();
    expect(session!.playlist).toEqual([{ surah: 112, ayah: 2 }]);
  });

  it("carries the repeat count", () => {
    const session = buildListenSession(
      {
        scope: "ayah",
        surah: 112,
        ayah: 2,
        repeatMode: "count",
        repeatCount: 10,
      },
      mushafData,
    );

    expect(session!.repeatMode).toBe("count");
    expect(session!.repeatCount).toBe(10);
  });

  it("supports repeating without end", () => {
    const session = buildListenSession(
      {
        scope: "ayah",
        surah: 112,
        ayah: 3,
        repeatMode: "infinite",
        repeatCount: 1,
      },
      mushafData,
    );

    expect(session!.repeatMode).toBe("infinite");
    expect(session!.playlist).toHaveLength(1);
  });
});
