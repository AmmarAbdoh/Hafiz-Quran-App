import https from "https";
import fs from "fs";

const AR_NAMES = {
  "Abdul Basit Murattal": "عبد الباسط عبد الصمد (المرتل)",
  "Abdul Basit Mujawwad": "عبد الباسط عبد الصمد (المجود)",
  "Abdullah Basfar": "عبد الله بصفر",
  "Abdurrahmaan As-Sudais": "عبد الرحمن السديس",
  "AbdulSamad QuranExplorer.Com": "عبد الصمد",
  "Abu Bakr Ash-Shaatree": "أبو بكر الشاطري",
  "Ahmed ibn Ali al-Ajamy QuranExplorer.Com": "أحمد بن علي العجمي",
  "Ahmed ibn Ali al-Ajamy KetabAllah.Net": "أحمد بن علي العجمي",
  Alafasy: "مشاري بن راشد العفاسي",
  Ghamadi: "سعد الغامدي",
  "Hani Rifai": "هاني الرفاعي",
  Husary: "محمود خليل الحصري",
  "Husary Mujawwad": "محمود خليل الحصري (مجود)",
  Hudhaify: "علي بن عبد الرحمن الحذيفي",
  "Ibrahim Akhdar": "إبراهيم الأخضر",
  "Maher Al Muaiqly": "ماهر المعيقلي",
  Menshawi: "محمد صديق المنشاوي",
  "Minshawy Mujawwad": "المنشاوي (مجود)",
  "Minshawy Murattal": "محمد صديق المنشاوي (مرتل)",
  "Mohammad al Tablaway": "محمد الطبلاوي",
  "Muhammad Ayyoub": "محمد أيوب",
  "Muhammad Jibreel": "محمد جبريل",
  "Mustafa Ismail": "مصطفى إسماعيل",
  "Saood bin Ibraaheem Ash-Shuraym": "سعود الشريم",
  "Salaah AbdulRahman Bukhatir": "صلاح بو خاطر",
  "Muhsin Al Qasim": "محسن القاسم",
  "Abdullaah 3awwaad Al-Juhaynee": "عبد الله الجهني",
  "Salah Al Budair": "صلاح البدير",
  "Abdullah Matroud": "عبد الله المطرود",
  "Ahmed Neana": "أحمد نعنا",
  "Muhammad AbdulKareem": "محمد عبد الكريم",
  "Khalefa Al-Tunaiji": "خليفة الطنيجي",
  "Mahmoud Ali Al-Banna": "محمود علي البنا",
  "Khalid Abdullah al-Qahtanee": "خالد عبد الله القحطاني",
  "Yasser_Ad-Dussary": "ياسر الدوسري",
  "Nasser_Alqatami": "ناصر القطامي",
  "Ali_Hajjaj_AlSuesy": "علي حجاج السويسي",
  Sahl_Yassin: "سهل ياسين",
  "Ahmed Ibn Ali Al Ajamy": "أحمد بن علي العجمي",
  "Aziz Alili": "عزيز عليلي",
  "Yaser Salamah": "ياسر سلامة",
  "Akram Al Alaqimy": "أكرم العلاقمي",
  "Ali Jaber": "علي جابر",
  "Fares Abbad": "فارس عباد",
  "Ayman Sowaid": "أيمن سويد",
  "Husary (Muallim)": "محمود خليل الحصري (معلم)",
  Parhizgar_64Kbps: "بارهيزغر",
  Balayev: "بالاييف (أذربيجاني)",
  "Karim Mansoori (Iran)": "كريم منصوري (إيران)",
  "(Warsh) Ibrahim Al-Dosary": "ورش: إبراهيم الدوسري",
  "(Warsh) Yassin Al-Jazaery": "ورش: ياسين الجزائري",
  "(Warsh) Abdul Basit": "ورش: عبد الباسط",
  "(English) Translated by Sahih International Recited by Ibrahim Walk":
    "إنجليزي: صحيح إنترناشيونال — إبراهيم ووك",
  "MultiLanguage/Basfar Walk": "متعدد اللغات: بصفر وووك",
  "(Persian) Translated by Makarem Recited by Kabiri":
    "فارسي: مکارم — کبیری",
  "(Persian) Translated by Fooladvand Recited by Hedayatfar":
    "فارسي: فولادوند — هدایتفر",
  "(Urdu) Shamshad Ali Khan": "أردو: شمشاد علي خان",
  "Besim Korkut (Bosnian)": "بوسني: بسيم كوركوت",
  "Farhat Hashmi (Urdu word for word translation)":
    "أردو: فرحت هاشمي (كلمة بكلمة)",
};

const ISLAMIC_ALIASES = {
  "ar.abdulbasitmurattal": ["abdul basit murattal", "عبد الباسط"],
  "ar.abdulsamad": ["abdulsamad", "عبد الصمد"],
  "ar.abdullahbasfar": ["abdullah basfar", "بصفر"],
  "ar.abdurrahmaansudais": ["as-sudais", "السديس"],
  "ar.shaatree": ["ash-shaatree", "الشاطري"],
  "ar.ahmedajamy": ["al-ajamy", "العجمي"],
  "ar.alafasy": ["alafasy", "العفاسي"],
  "ar.aymanswoaid": ["ayman sowaid", "أيمن سويد"],
  "ar.hanirifai": ["hani rifai", "الرفاعي"],
  "ar.hudhaify": ["hudhaify", "الحذيفي"],
  "ar.husary": ["husary", "الحصري"],
  "ar.husarymujawwad": ["husary mujawwad", "حصري مجود"],
  "ar.ibrahimakhbar": ["ibrahim akhdar", "الأخضر"],
  "ar.mahermuaiqly": ["maher", "المعيقلي"],
  "ar.minshawi": ["minshawi murattal", "منشاوي مرتل"],
  "ar.minshawimujawwad": ["minshawy mujawwad", "منشاوي مجود"],
  "ar.muhammadayyoub": ["muhammad ayyoub", "محمد أيوب"],
  "ar.muhammadjibreel": ["muhammad jibreel", "محمد جبريل"],
  "ar.parhizgar": ["parhizgar", "بارهيزغر"],
  "ar.saoodshuraym": ["ash-shuraym", "الشريم"],
  "en.walk": ["ibrahim walk", "إنجليزي"],
  "fa.hedayatfarfooladvand": ["fooladvand", "فارسي"],
  "ur.khan": ["shamshad", "أردو"],
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

function categoryEveryAyah(subfolder, name) {
  if (subfolder.startsWith("warsh/") || name.includes("(Warsh)")) return "warsh";
  if (
    subfolder.startsWith("translations/") ||
    subfolder.startsWith("English/") ||
    subfolder.startsWith("MultiLanguage/") ||
    name.includes("Translated") ||
    name.includes("Urdu") ||
    name.includes("Persian") ||
    name.includes("Bosnian") ||
    name.includes("English")
  ) {
    return "translation";
  }
  return "hafs";
}

function categoryIslamic(identifier, language) {
  if (identifier.includes("warsh")) return "warsh";
  if (language !== "ar") return "translation";
  return "hafs";
}

function bitrateScore(bitrate) {
  const match = String(bitrate).match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function normalizeKey(text) {
  return text
    .toLowerCase()
    .replace(/[أإآا]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toArabicNameEveryAyah(name) {
  return (
    AR_NAMES[name] ??
    name
      .replace(/^\(English\)\s*/, "إنجليزي: ")
      .replace(/^\(Persian\)\s*/, "فارسي: ")
      .replace(/^\(Urdu\)\s*/, "أردو: ")
      .replace(/^\(Warsh\)\s*/, "ورش: ")
  );
}

function toIdEveryAyah(subfolder) {
  return `ea-${subfolder.replace(/[\\/]/g, "__")}`;
}

function pickBestPerReciter(entries) {
  const bestByName = new Map();
  for (const entry of entries) {
    const current = bestByName.get(entry.nameEn);
    if (
      !current ||
      bitrateScore(entry.bitrate) > bitrateScore(current.bitrate)
    ) {
      bestByName.set(entry.nameEn, entry);
    }
  }
  return [...bestByName.values()];
}

function isIslamicDuplicate(entry, everyAyahReciters) {
  const keys = new Set([
    normalizeKey(entry.nameAr),
    normalizeKey(entry.nameEn),
    ...(ISLAMIC_ALIASES[entry.slug] ?? []).map(normalizeKey),
  ]);

  return everyAyahReciters.some((reciter) => {
    const haystack = normalizeKey(`${reciter.nameAr} ${reciter.nameEn}`);
    for (const key of keys) {
      if (key.length >= 4 && haystack.includes(key)) return true;
    }
    return false;
  });
}

const everyAyahData = await fetchJson(
  "https://everyayah.com/data/recitations.js",
);
const islamicData = await fetchJson(
  "https://api.islamic.app/v1/audio/reciters",
);

const everyAyahEntries = Object.entries(everyAyahData)
  .filter(([key]) => key !== "ayahCount")
  .map(([, value]) => ({
    id: toIdEveryAyah(value.subfolder),
    nameAr: toArabicNameEveryAyah(value.name),
    nameEn: value.name,
    folder: value.subfolder,
    bitrate: value.bitrate,
    category: categoryEveryAyah(value.subfolder, value.name),
    source: "everyayah",
  }));

const everyAyahReciters = pickBestPerReciter(everyAyahEntries).map((entry) => ({
  id: entry.id,
  nameAr: entry.nameAr,
  nameEn: entry.nameEn,
  category: entry.category,
  source: "everyayah",
  folder: entry.folder,
  slug: undefined,
  bitrate: entry.bitrate,
}));

const islamicOnlyCandidates = islamicData.data
  .filter((reciter) => reciter.audioLevels?.includes("ayah"))
  .filter(
    (reciter) =>
      !isIslamicDuplicate(
        {
          nameAr: reciter.name,
          nameEn: reciter.englishName,
          slug: reciter.identifier,
        },
        everyAyahReciters,
      ),
  )
  .map((reciter) => ({
    id: `ia-${reciter.identifier.replace(/\./g, "_")}`,
    nameAr: reciter.name,
    nameEn: reciter.englishName,
    category: categoryIslamic(reciter.identifier, reciter.language),
    source: "islamicapp",
    folder: undefined,
    slug: reciter.identifier,
    bitrate: undefined,
  }));

function islamicReciterKey(nameEn) {
  return normalizeKey(nameEn)
    .replace(/\s+\d+\b/g, "")
    .replace(/\s+by\s+.*/g, "")
    .trim();
}

const islamicBestByName = new Map();
for (const entry of islamicOnlyCandidates) {
  const key = islamicReciterKey(entry.nameEn);
  const current = islamicBestByName.get(key);
  if (!current || entry.slug.localeCompare(current.slug) > 0) {
    islamicBestByName.set(key, entry);
  }
}
const islamicAyahReciters = [...islamicBestByName.values()];

const reciters = [...everyAyahReciters, ...islamicAyahReciters].sort(
  (a, b) => {
    const order = { hafs: 0, warsh: 1, translation: 2 };
    if (order[a.category] !== order[b.category]) {
      return order[a.category] - order[b.category];
    }
    return a.nameAr.localeCompare(b.nameAr, "ar");
  },
);

const legacy = {
  alafasy: "Alafasy_128kbps",
  sudais: "Abdurrahmaan_As-Sudais_192kbps",
  shuraym: "Saood_ash-Shuraym_128kbps",
  hudhaify: "Hudhaify_128kbps",
  husary: "Husary_128kbps",
  basit: "Abdul_Basit_Murattal_192kbps",
  minshawi: "Minshawy_Murattal_128kbps",
  ghamdi: "Ghamadi_40kbps",
  maher: "MaherAlMuaiqly128kbps",
  ayyoub: "Muhammad_Ayyoub_128kbps",
  dussary: "Yasser_Ad-Dussary_128kbps",
  budair: "Salah_Al_Budair_128kbps",
  bukhatir: "Salaah_AbdulRahman_Bukhatir_128kbps",
};

const folderToNameEn = Object.fromEntries(
  everyAyahEntries.map((entry) => [entry.folder, entry.nameEn]),
);

const file = `export type ReciterCategory = "hafs" | "warsh" | "translation";
export type ReciterAudioSource = "everyayah" | "islamicapp";

export interface ReciterOption {
  id: string;
  nameAr: string;
  nameEn: string;
  category: ReciterCategory;
  source: ReciterAudioSource;
  /** EveryAyah folder name */
  folder?: string;
  /** islamic.app identifier slug */
  slug?: string;
  bitrate?: string;
}

/** Ayah-by-ayah reciters: EveryAyah.com + islamic.app (free CDN). */
export const RECITERS: ReciterOption[] = ${JSON.stringify(reciters, null, 2)};

export const SURAH_AYAH_COUNTS: readonly number[] = ${JSON.stringify(everyAyahData.ayahCount)} as const;

export const DEFAULT_RECITER_ID = ${JSON.stringify(toIdEveryAyah("Alafasy_128kbps"))};

export const RECITER_CATEGORY_LABELS: Record<ReciterCategory, string> = {
  hafs: "رواية حفص عن عاصم",
  warsh: "رواية ورش",
  translation: "ترجمات ولغات أخرى",
};

const LEGACY_RECITER_FOLDERS: Record<string, string> = ${JSON.stringify(legacy, null, 2)};

const FOLDER_TO_NAME_EN: Record<string, string> = ${JSON.stringify(folderToNameEn, null, 2)};

function folderFromEveryAyahId(id: string): string | null {
  if (!id.startsWith("ea-")) return null;
  return id.slice(3).replace(/__/g, "/");
}

export function getReciterById(id: string): ReciterOption {
  const direct = RECITERS.find((r) => r.id === id);
  if (direct) return direct;

  const legacyFolder = LEGACY_RECITER_FOLDERS[id];
  if (legacyFolder) {
    const legacy = RECITERS.find((r) => r.folder === legacyFolder);
    if (legacy) return legacy;
  }

  const folder = folderFromEveryAyahId(id);
  if (folder) {
    const byFolder = RECITERS.find((r) => r.folder === folder);
    if (byFolder) return byFolder;

    const nameEn = FOLDER_TO_NAME_EN[folder];
    if (nameEn) {
      const byName = RECITERS.find(
        (r) => r.source === "everyayah" && r.nameEn === nameEn,
      );
      if (byName) return byName;
    }
  }

  return RECITERS.find((r) => r.id === DEFAULT_RECITER_ID)!;
}

export function getRecitersByCategory(): {
  category: ReciterCategory;
  label: string;
  reciters: ReciterOption[];
}[] {
  const categories: ReciterCategory[] = ["hafs", "warsh", "translation"];
  return categories
    .map((category) => ({
      category,
      label: RECITER_CATEGORY_LABELS[category],
      reciters: RECITERS.filter((r) => r.category === category),
    }))
    .filter((group) => group.reciters.length > 0);
}
`;

fs.writeFileSync("src/shared/constants/reciters.ts", file);
console.log(
  `Wrote ${reciters.length} ayah reciters (${everyAyahReciters.length} EveryAyah + ${islamicAyahReciters.length} islamic.app)`,
);
