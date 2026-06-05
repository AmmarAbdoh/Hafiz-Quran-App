/** Maps app reciter ids to Quran.com recitation ids (for segments + timing). */
export const RECITER_QURAN_COM_IDS: Record<string, number> = {
  "ea-Alafasy_128kbps": 7,
  "ea-Abdurrahmaan_As-Sudais_192kbps": 3,
  "ea-Abu_Bakr_Ash-Shaatree_128kbps": 4,
  "ea-Hani_Rifai_192kbps": 5,
  "ea-Husary_128kbps": 6,
  "ea-Husary_Muallim_128kbps": 12,
  "ea-Minshawy_Murattal_128kbps": 9,
  "ea-Minshawy_Mujawwad_192kbps": 8,
  "ea-Saood_ash-Shuraym_128kbps": 10,
  "ea-Mohammad_al_Tablaway_128kbps": 11,
  "ea-Abdul_Basit_Murattal_192kbps": 2,
  "ea-Abdul_Basit_Mujawwad_128kbps": 1,
};

export function getQuranComRecitationId(reciterId: string): number | null {
  return RECITER_QURAN_COM_IDS[reciterId] ?? null;
}
