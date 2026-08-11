import { quranRepository } from "./QuranRepository";

export function loadTafseer(
  tafseerId: string,
  surah: number,
  ayah: number,
): Promise<string> {
  return quranRepository.loadTafsirText(tafseerId, surah, ayah);
}
