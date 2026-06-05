export type ReciterCategory = "hafs" | "warsh" | "translation";
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
export const RECITERS: ReciterOption[] = [
  {
    "id": "ea-Ibrahim_Akhdar_64kbps",
    "nameAr": "إبراهيم الأخضر",
    "nameEn": "Ibrahim Akhdar",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Ibrahim_Akhdar_64kbps",
    "bitrate": "64kbps"
  },
  {
    "id": "ea-Abu_Bakr_Ash-Shaatree_128kbps",
    "nameAr": "أبو بكر الشاطري",
    "nameEn": "Abu Bakr Ash-Shaatree",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Abu_Bakr_Ash-Shaatree_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Ahmed_ibn_Ali_al-Ajamy_64kbps_QuranExplorer.Com",
    "nameAr": "أحمد بن علي العجمي",
    "nameEn": "Ahmed ibn Ali al-Ajamy QuranExplorer.Com",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Ahmed_ibn_Ali_al-Ajamy_64kbps_QuranExplorer.Com",
    "bitrate": "64kbps"
  },
  {
    "id": "ea-Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net",
    "nameAr": "أحمد بن علي العجمي",
    "nameEn": "Ahmed ibn Ali al-Ajamy KetabAllah.Net",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-ahmed_ibn_ali_al_ajamy_128kbps",
    "nameAr": "أحمد بن علي العجمي",
    "nameEn": "Ahmed Ibn Ali Al Ajamy",
    "category": "hafs",
    "source": "everyayah",
    "folder": "ahmed_ibn_ali_al_ajamy_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Ahmed_Neana_128kbps",
    "nameAr": "أحمد نعنا",
    "nameEn": "Ahmed Neana",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Ahmed_Neana_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Akram_AlAlaqimy_128kbps",
    "nameAr": "أكرم العلاقمي",
    "nameEn": "Akram Al Alaqimy",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Akram_AlAlaqimy_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Minshawy_Mujawwad_192kbps",
    "nameAr": "المنشاوي (مجود)",
    "nameEn": "Minshawy Mujawwad",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Minshawy_Mujawwad_192kbps",
    "bitrate": "192kbps"
  },
  {
    "id": "ea-Ayman_Sowaid_64kbps",
    "nameAr": "أيمن سويد",
    "nameEn": "Ayman Sowaid",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Ayman_Sowaid_64kbps",
    "bitrate": "64kbps"
  },
  {
    "id": "ea-Parhizgar_48kbps",
    "nameAr": "بارهيزغر",
    "nameEn": "Parhizgar_64Kbps",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Parhizgar_48kbps",
    "bitrate": "64Kbps"
  },
  {
    "id": "ea-Khaalid_Abdullaah_al-Qahtaanee_192kbps",
    "nameAr": "خالد عبد الله القحطاني",
    "nameEn": "Khalid Abdullah al-Qahtanee",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Khaalid_Abdullaah_al-Qahtaanee_192kbps",
    "bitrate": "192kbps"
  },
  {
    "id": "ea-khalefa_al_tunaiji_64kbps",
    "nameAr": "خليفة الطنيجي",
    "nameEn": "Khalefa Al-Tunaiji",
    "category": "hafs",
    "source": "everyayah",
    "folder": "khalefa_al_tunaiji_64kbps",
    "bitrate": "64kbps"
  },
  {
    "id": "ea-Ghamadi_40kbps",
    "nameAr": "سعد الغامدي",
    "nameEn": "Ghamadi",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Ghamadi_40kbps",
    "bitrate": "40kbps"
  },
  {
    "id": "ea-Saood_ash-Shuraym_128kbps",
    "nameAr": "سعود الشريم",
    "nameEn": "Saood bin Ibraaheem Ash-Shuraym",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Saood_ash-Shuraym_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Sahl_Yassin_128kbps",
    "nameAr": "سهل ياسين",
    "nameEn": "Sahl_Yassin",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Sahl_Yassin_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Salah_Al_Budair_128kbps",
    "nameAr": "صلاح البدير",
    "nameEn": "Salah Al Budair",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Salah_Al_Budair_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Salaah_AbdulRahman_Bukhatir_128kbps",
    "nameAr": "صلاح بو خاطر",
    "nameEn": "Salaah AbdulRahman Bukhatir",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Salaah_AbdulRahman_Bukhatir_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Abdul_Basit_Mujawwad_128kbps",
    "nameAr": "عبد الباسط عبد الصمد (المجود)",
    "nameEn": "Abdul Basit Mujawwad",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Abdul_Basit_Mujawwad_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Abdul_Basit_Murattal_192kbps",
    "nameAr": "عبد الباسط عبد الصمد (المرتل)",
    "nameEn": "Abdul Basit Murattal",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Abdul_Basit_Murattal_192kbps",
    "bitrate": "192kbps"
  },
  {
    "id": "ea-Abdurrahmaan_As-Sudais_192kbps",
    "nameAr": "عبد الرحمن السديس",
    "nameEn": "Abdurrahmaan As-Sudais",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Abdurrahmaan_As-Sudais_192kbps",
    "bitrate": "192kbps"
  },
  {
    "id": "ea-AbdulSamad_64kbps_QuranExplorer.Com",
    "nameAr": "عبد الصمد",
    "nameEn": "AbdulSamad QuranExplorer.Com",
    "category": "hafs",
    "source": "everyayah",
    "folder": "AbdulSamad_64kbps_QuranExplorer.Com",
    "bitrate": "64kbps"
  },
  {
    "id": "ea-Abdullaah_3awwaad_Al-Juhaynee_128kbps",
    "nameAr": "عبد الله الجهني",
    "nameEn": "Abdullaah 3awwaad Al-Juhaynee",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Abdullaah_3awwaad_Al-Juhaynee_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Abdullah_Matroud_128kbps",
    "nameAr": "عبد الله المطرود",
    "nameEn": "Abdullah Matroud",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Abdullah_Matroud_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Abdullah_Basfar_192kbps",
    "nameAr": "عبد الله بصفر",
    "nameEn": "Abdullah Basfar",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Abdullah_Basfar_192kbps",
    "bitrate": "192kbps"
  },
  {
    "id": "ea-aziz_alili_128kbps",
    "nameAr": "عزيز عليلي",
    "nameEn": "Aziz Alili",
    "category": "hafs",
    "source": "everyayah",
    "folder": "aziz_alili_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Hudhaify_128kbps",
    "nameAr": "علي بن عبد الرحمن الحذيفي",
    "nameEn": "Hudhaify",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Hudhaify_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Ali_Jaber_64kbps",
    "nameAr": "علي جابر",
    "nameEn": "Ali Jaber",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Ali_Jaber_64kbps",
    "bitrate": "64kbps"
  },
  {
    "id": "ea-Ali_Hajjaj_AlSuesy_128kbps",
    "nameAr": "علي حجاج السويسي",
    "nameEn": "Ali_Hajjaj_AlSuesy",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Ali_Hajjaj_AlSuesy_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Fares_Abbad_64kbps",
    "nameAr": "فارس عباد",
    "nameEn": "Fares Abbad",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Fares_Abbad_64kbps",
    "bitrate": "64kbps"
  },
  {
    "id": "ea-Karim_Mansoori_40kbps",
    "nameAr": "كريم منصوري (إيران)",
    "nameEn": "Karim Mansoori (Iran)",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Karim_Mansoori_40kbps",
    "bitrate": "40kbps"
  },
  {
    "id": "ea-MaherAlMuaiqly128kbps",
    "nameAr": "ماهر المعيقلي",
    "nameEn": "Maher Al Muaiqly",
    "category": "hafs",
    "source": "everyayah",
    "folder": "MaherAlMuaiqly128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Muhsin_Al_Qasim_192kbps",
    "nameAr": "محسن القاسم",
    "nameEn": "Muhsin Al Qasim",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Muhsin_Al_Qasim_192kbps",
    "bitrate": "192kbps"
  },
  {
    "id": "ea-Mohammad_al_Tablaway_128kbps",
    "nameAr": "محمد الطبلاوي",
    "nameEn": "Mohammad al Tablaway",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Mohammad_al_Tablaway_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Muhammad_Ayyoub_128kbps",
    "nameAr": "محمد أيوب",
    "nameEn": "Muhammad Ayyoub",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Muhammad_Ayyoub_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Muhammad_Jibreel_128kbps",
    "nameAr": "محمد جبريل",
    "nameEn": "Muhammad Jibreel",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Muhammad_Jibreel_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Menshawi_32kbps",
    "nameAr": "محمد صديق المنشاوي",
    "nameEn": "Menshawi",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Menshawi_32kbps",
    "bitrate": "32kbps"
  },
  {
    "id": "ea-Minshawy_Murattal_128kbps",
    "nameAr": "محمد صديق المنشاوي (مرتل)",
    "nameEn": "Minshawy Murattal",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Minshawy_Murattal_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Muhammad_AbdulKareem_128kbps",
    "nameAr": "محمد عبد الكريم",
    "nameEn": "Muhammad AbdulKareem",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Muhammad_AbdulKareem_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Husary_128kbps",
    "nameAr": "محمود خليل الحصري",
    "nameEn": "Husary",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Husary_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Husary_128kbps_Mujawwad",
    "nameAr": "محمود خليل الحصري (مجود)",
    "nameEn": "Husary Mujawwad",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Husary_128kbps_Mujawwad",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Husary_Muallim_128kbps",
    "nameAr": "محمود خليل الحصري (معلم)",
    "nameEn": "Husary (Muallim)",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Husary_Muallim_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-mahmoud_ali_al_banna_32kbps",
    "nameAr": "محمود علي البنا",
    "nameEn": "Mahmoud Ali Al-Banna",
    "category": "hafs",
    "source": "everyayah",
    "folder": "mahmoud_ali_al_banna_32kbps",
    "bitrate": "32kbps"
  },
  {
    "id": "ea-Alafasy_128kbps",
    "nameAr": "مشاري بن راشد العفاسي",
    "nameEn": "Alafasy",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Alafasy_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Mustafa_Ismail_48kbps",
    "nameAr": "مصطفى إسماعيل",
    "nameEn": "Mustafa Ismail",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Mustafa_Ismail_48kbps",
    "bitrate": "48kbps"
  },
  {
    "id": "ea-Nasser_Alqatami_128kbps",
    "nameAr": "ناصر القطامي",
    "nameEn": "Nasser_Alqatami",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Nasser_Alqatami_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Hani_Rifai_192kbps",
    "nameAr": "هاني الرفاعي",
    "nameEn": "Hani Rifai",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Hani_Rifai_192kbps",
    "bitrate": "192kbps"
  },
  {
    "id": "ea-Yasser_Ad-Dussary_128kbps",
    "nameAr": "ياسر الدوسري",
    "nameEn": "Yasser_Ad-Dussary",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Yasser_Ad-Dussary_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-Yaser_Salamah_128kbps",
    "nameAr": "ياسر سلامة",
    "nameEn": "Yaser Salamah",
    "category": "hafs",
    "source": "everyayah",
    "folder": "Yaser_Salamah_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-warsh__warsh_ibrahim_aldosary_128kbps",
    "nameAr": "ورش: إبراهيم الدوسري",
    "nameEn": "(Warsh) Ibrahim Al-Dosary",
    "category": "warsh",
    "source": "everyayah",
    "folder": "warsh/warsh_ibrahim_aldosary_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-warsh__warsh_Abdul_Basit_128kbps",
    "nameAr": "ورش: عبد الباسط",
    "nameEn": "(Warsh) Abdul Basit",
    "category": "warsh",
    "source": "everyayah",
    "folder": "warsh/warsh_Abdul_Basit_128kbps",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-warsh__warsh_yassin_al_jazaery_64kbps",
    "nameAr": "ورش: ياسين الجزائري",
    "nameEn": "(Warsh) Yassin Al-Jazaery",
    "category": "warsh",
    "source": "everyayah",
    "folder": "warsh/warsh_yassin_al_jazaery_64kbps",
    "bitrate": "64kbps"
  },
  {
    "id": "ea-translations__urdu_shamshad_ali_khan_46kbps",
    "nameAr": "أردو: شمشاد علي خان",
    "nameEn": "(Urdu) Shamshad Ali Khan",
    "category": "translation",
    "source": "everyayah",
    "folder": "translations/urdu_shamshad_ali_khan_46kbps",
    "bitrate": "46kbps"
  },
  {
    "id": "ea-translations__urdu_farhat_hashmi",
    "nameAr": "أردو: فرحت هاشمي (كلمة بكلمة)",
    "nameEn": "Farhat Hashmi (Urdu word for word translation)",
    "category": "translation",
    "source": "everyayah",
    "folder": "translations/urdu_farhat_hashmi",
    "bitrate": "32kbps"
  },
  {
    "id": "ea-English__Sahih_Intnl_Ibrahim_Walk_192kbps",
    "nameAr": "إنجليزي: صحيح إنترناشيونال — إبراهيم ووك",
    "nameEn": "(English) Translated by Sahih International Recited by Ibrahim Walk",
    "category": "translation",
    "source": "everyayah",
    "folder": "English/Sahih_Intnl_Ibrahim_Walk_192kbps",
    "bitrate": "192kbps"
  },
  {
    "id": "ea-translations__azerbaijani__balayev",
    "nameAr": "بالاييف (أذربيجاني)",
    "nameEn": "Balayev",
    "category": "translation",
    "source": "everyayah",
    "folder": "translations/azerbaijani/balayev",
    "bitrate": "64Kbps"
  },
  {
    "id": "ea-translations__besim_korkut_ajet_po_ajet",
    "nameAr": "بوسني: بسيم كوركوت",
    "nameEn": "Besim Korkut (Bosnian)",
    "category": "translation",
    "source": "everyayah",
    "folder": "translations/besim_korkut_ajet_po_ajet",
    "bitrate": "128kbps"
  },
  {
    "id": "ea-translations__Fooladvand_Hedayatfar_40Kbps",
    "nameAr": "فارسي: فولادوند — هدایتفر",
    "nameEn": "(Persian) Translated by Fooladvand Recited by Hedayatfar",
    "category": "translation",
    "source": "everyayah",
    "folder": "translations/Fooladvand_Hedayatfar_40Kbps",
    "bitrate": "64Kbps"
  },
  {
    "id": "ea-translations__Makarem_Kabiri_16Kbps",
    "nameAr": "فارسي: مکارم — کبیری",
    "nameEn": "(Persian) Translated by Makarem Recited by Kabiri",
    "category": "translation",
    "source": "everyayah",
    "folder": "translations/Makarem_Kabiri_16Kbps",
    "bitrate": "64Kbps"
  },
  {
    "id": "ea-MultiLanguage__Basfar_Walk_192kbps",
    "nameAr": "متعدد اللغات: بصفر وووك",
    "nameEn": "MultiLanguage/Basfar Walk",
    "category": "translation",
    "source": "everyayah",
    "folder": "MultiLanguage/Basfar_Walk_192kbps",
    "bitrate": "192kbps"
  },
  {
    "id": "ia-ru_kuliev-audio-2",
    "nameAr": "Elmir Kuliev 2 by 1MuslimApp",
    "nameEn": "Elmir Kuliev 2 by 1MuslimApp",
    "category": "translation",
    "source": "islamicapp",
    "slug": "ru.kuliev-audio-2"
  },
  {
    "id": "ia-fr_leclerc",
    "nameAr": "Youssouf Leclerc",
    "nameEn": "Youssouf Leclerc",
    "category": "translation",
    "source": "islamicapp",
    "slug": "fr.leclerc"
  },
  {
    "id": "ia-zh_chinese",
    "nameAr": "中文",
    "nameEn": "Chinese",
    "category": "translation",
    "source": "islamicapp",
    "slug": "zh.chinese"
  }
];

export const SURAH_AYAH_COUNTS: readonly number[] = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6] as const;

export const DEFAULT_RECITER_ID = "ea-Alafasy_128kbps";

export const RECITER_CATEGORY_LABELS: Record<ReciterCategory, string> = {
  hafs: "رواية حفص عن عاصم",
  warsh: "رواية ورش",
  translation: "ترجمات ولغات أخرى",
};

const LEGACY_RECITER_FOLDERS: Record<string, string> = {
  "alafasy": "Alafasy_128kbps",
  "sudais": "Abdurrahmaan_As-Sudais_192kbps",
  "shuraym": "Saood_ash-Shuraym_128kbps",
  "hudhaify": "Hudhaify_128kbps",
  "husary": "Husary_128kbps",
  "basit": "Abdul_Basit_Murattal_192kbps",
  "minshawi": "Minshawy_Murattal_128kbps",
  "ghamdi": "Ghamadi_40kbps",
  "maher": "MaherAlMuaiqly128kbps",
  "ayyoub": "Muhammad_Ayyoub_128kbps",
  "dussary": "Yasser_Ad-Dussary_128kbps",
  "budair": "Salah_Al_Budair_128kbps",
  "bukhatir": "Salaah_AbdulRahman_Bukhatir_128kbps"
};

const FOLDER_TO_NAME_EN: Record<string, string> = {
  "Abdul_Basit_Murattal_64kbps": "Abdul Basit Murattal",
  "Abdul_Basit_Murattal_192kbps": "Abdul Basit Murattal",
  "Abdul_Basit_Mujawwad_128kbps": "Abdul Basit Mujawwad",
  "Abdullah_Basfar_32kbps": "Abdullah Basfar",
  "Abdullah_Basfar_64kbps": "Abdullah Basfar",
  "Abdullah_Basfar_192kbps": "Abdullah Basfar",
  "Abdurrahmaan_As-Sudais_64kbps": "Abdurrahmaan As-Sudais",
  "Abdurrahmaan_As-Sudais_192kbps": "Abdurrahmaan As-Sudais",
  "AbdulSamad_64kbps_QuranExplorer.Com": "AbdulSamad QuranExplorer.Com",
  "Abu_Bakr_Ash-Shaatree_64kbps": "Abu Bakr Ash-Shaatree",
  "Abu_Bakr_Ash-Shaatree_128kbps": "Abu Bakr Ash-Shaatree",
  "Ahmed_ibn_Ali_al-Ajamy_64kbps_QuranExplorer.Com": "Ahmed ibn Ali al-Ajamy QuranExplorer.Com",
  "Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net": "Ahmed ibn Ali al-Ajamy KetabAllah.Net",
  "Alafasy_64kbps": "Alafasy",
  "Alafasy_128kbps": "Alafasy",
  "Ghamadi_40kbps": "Ghamadi",
  "Hani_Rifai_64kbps": "Hani Rifai",
  "Hani_Rifai_192kbps": "Hani Rifai",
  "Husary_64kbps": "Husary",
  "Husary_128kbps": "Husary",
  "Husary_Mujawwad_64kbps": "Husary Mujawwad",
  "Husary_128kbps_Mujawwad": "Husary Mujawwad",
  "Hudhaify_32kbps": "Hudhaify",
  "Hudhaify_64kbps": "Hudhaify",
  "Hudhaify_128kbps": "Hudhaify",
  "Ibrahim_Akhdar_32kbps": "Ibrahim Akhdar",
  "Ibrahim_Akhdar_64kbps": "Ibrahim Akhdar",
  "Maher_AlMuaiqly_64kbps": "Maher Al Muaiqly",
  "MaherAlMuaiqly128kbps": "Maher Al Muaiqly",
  "Menshawi_16kbps": "Menshawi",
  "Menshawi_32kbps": "Menshawi",
  "Minshawy_Mujawwad_64kbps": "Minshawy Mujawwad",
  "Minshawy_Mujawwad_192kbps": "Minshawy Mujawwad",
  "Minshawy_Murattal_128kbps": "Minshawy Murattal",
  "Mohammad_al_Tablaway_64kbps": "Mohammad al Tablaway",
  "Mohammad_al_Tablaway_128kbps": "Mohammad al Tablaway",
  "Muhammad_Ayyoub_128kbps": "Muhammad Ayyoub",
  "Muhammad_Ayyoub_64kbps": "Muhammad Ayyoub",
  "Muhammad_Ayyoub_32kbps": "Muhammad Ayyoub",
  "Muhammad_Jibreel_64kbps": "Muhammad Jibreel",
  "Muhammad_Jibreel_128kbps": "Muhammad Jibreel",
  "Mustafa_Ismail_48kbps": "Mustafa Ismail",
  "Saood_ash-Shuraym_64kbps": "Saood bin Ibraaheem Ash-Shuraym",
  "Saood_ash-Shuraym_128kbps": "Saood bin Ibraaheem Ash-Shuraym",
  "English/Sahih_Intnl_Ibrahim_Walk_192kbps": "(English) Translated by Sahih International Recited by Ibrahim Walk",
  "MultiLanguage/Basfar_Walk_192kbps": "MultiLanguage/Basfar Walk",
  "translations/Makarem_Kabiri_16Kbps": "(Persian) Translated by Makarem Recited by Kabiri",
  "translations/Fooladvand_Hedayatfar_40Kbps": "(Persian) Translated by Fooladvand Recited by Hedayatfar",
  "Parhizgar_48kbps": "Parhizgar_64Kbps",
  "translations/azerbaijani/balayev": "Balayev",
  "Salaah_AbdulRahman_Bukhatir_128kbps": "Salaah AbdulRahman Bukhatir",
  "Muhsin_Al_Qasim_192kbps": "Muhsin Al Qasim",
  "Abdullaah_3awwaad_Al-Juhaynee_128kbps": "Abdullaah 3awwaad Al-Juhaynee",
  "Salah_Al_Budair_128kbps": "Salah Al Budair",
  "Abdullah_Matroud_128kbps": "Abdullah Matroud",
  "Ahmed_Neana_128kbps": "Ahmed Neana",
  "Muhammad_AbdulKareem_128kbps": "Muhammad AbdulKareem",
  "khalefa_al_tunaiji_64kbps": "Khalefa Al-Tunaiji",
  "mahmoud_ali_al_banna_32kbps": "Mahmoud Ali Al-Banna",
  "warsh/warsh_ibrahim_aldosary_128kbps": "(Warsh) Ibrahim Al-Dosary",
  "warsh/warsh_yassin_al_jazaery_64kbps": "(Warsh) Yassin Al-Jazaery",
  "warsh/warsh_Abdul_Basit_128kbps": "(Warsh) Abdul Basit",
  "translations/urdu_shamshad_ali_khan_46kbps": "(Urdu) Shamshad Ali Khan",
  "Karim_Mansoori_40kbps": "Karim Mansoori (Iran)",
  "Husary_Muallim_128kbps": "Husary (Muallim)",
  "Khaalid_Abdullaah_al-Qahtaanee_192kbps": "Khalid Abdullah al-Qahtanee",
  "Yasser_Ad-Dussary_128kbps": "Yasser_Ad-Dussary",
  "Nasser_Alqatami_128kbps": "Nasser_Alqatami",
  "Ali_Hajjaj_AlSuesy_128kbps": "Ali_Hajjaj_AlSuesy",
  "Sahl_Yassin_128kbps": "Sahl_Yassin",
  "ahmed_ibn_ali_al_ajamy_128kbps": "Ahmed Ibn Ali Al Ajamy",
  "translations/besim_korkut_ajet_po_ajet": "Besim Korkut (Bosnian)",
  "aziz_alili_128kbps": "Aziz Alili",
  "Yaser_Salamah_128kbps": "Yaser Salamah",
  "Akram_AlAlaqimy_128kbps": "Akram Al Alaqimy",
  "Ali_Jaber_64kbps": "Ali Jaber",
  "Fares_Abbad_64kbps": "Fares Abbad",
  "translations/urdu_farhat_hashmi": "Farhat Hashmi (Urdu word for word translation)",
  "Ayman_Sowaid_64kbps": "Ayman Sowaid"
};

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
