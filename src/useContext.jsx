import React, { createContext, useState, useEffect } from "react";

import versesData from "../src/Quran/quran_verses_imlaei_cleaned.json"; // Import your JSON file
import UthmaniVersesData from "../src/Quran/Quran_Uthmani.json";

export const MyContext = createContext();

export const MyProvider = ({ children }) => {
  const surahNames = [
    "الفاتحة",
    "البقرة",
    "آل عمران",
    "النساء",
    "المائدة",
    "الأنعام",
    "الأعراف",
    "الأنفال",
    "التوبة",
    "يونس",
    "هود",
    "يوسف",
    "الرعد",
    "إبراهيم",
    "الحجر",
    "النحل",
    "الإسراء",
    "الكهف",
    "مريم",
    "طه",
    "الأنبياء",
    "الحج",
    "المؤمنون",
    "النور",
    "الفرقان",
    "الشعراء",
    "النمل",
    "القصص",
    "العنكبوت",
    "الروم",
    "لقمان",
    "السجدة",
    "الأحزاب",
    "سبأ",
    "فاطر",
    "يس",
    "الصافات",
    "ص",
    "الزمر",
    "غافر",
    "فصلت",
    "الشورى",
    "الزخرف",
    "الدخان",
    "الجاثية",
    "الأحقاف",
    "محمد",
    "الفتح",
    "الحجرات",
    "ق",
    "الذاريات",
    "الطور",
    "النجم",
    "القمر",
    "الرحمن",
    "الواقعة",
    "الحديد",
    "المجادلة",
    "الحشر",
    "الممتحنة",
    "الصف",
    "الجمعة",
    "المنافقون",
    "التغابن",
    "الطلاق",
    "التحريم",
    "الملك",
    "القلم",
    "الحاقة",
    "المعارج",
    "نوح",
    "الجن",
    "المزمل",
    "المدثر",
    "القيامة",
    "الإنسان",
    "المرسلات",
    "النبأ",
    "النازعات",
    "عبس",
    "التكوير",
    "الإنفطار",
    "المطففين",
    "الإنشقاق",
    "البروج",
    "الطارق",
    "الأعلى",
    "الغاشية",
    "الفجر",
    "البلد",
    "الشمس",
    "الليل",
    "الضحى",
    "الشرح",
    "التين",
    "العلق",
    "القدر",
    "البينة",
    "الزلزلة",
    "العاديات",
    "القارعة",
    "التكاثر",
    "العصر",
    "الهمزة",
    "الفيل",
    "قريش",
    "الماعون",
    "الكوثر",
    "الكافرون",
    "النصر",
    "المسد",
    "الإخلاص",
    "الفلق",
    "الناس",
  ];
  const [quranSelection, setQuranSelection] = useState([]);
  const [verses, setVerses] = useState([]);
  const [UthmaniVersesMap, setUthmaniVersesMap] = useState({});
  const [SimpleVersesMap, setSimpleVersesMap] = useState({});
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    // Preprocess the data once
    const uniqueVerses = Array.from(
      new Set(versesData.verses.map((verse) => verse.text_imlaei))
    ).map((uniqueText) =>
      versesData.verses.find((verse) => verse.text_imlaei === uniqueText)
    );

    setVerses(uniqueVerses);

    // Create a map for Uthmani verses
    const uthmaniMap = {};
    UthmaniVersesData.verses.forEach((verse) => {
      uthmaniMap[verse.verse_key] = verse;
    });
    setUthmaniVersesMap(uthmaniMap);

    // Create a map for Simple verses
    const simpleMap = {};
    versesData.verses.forEach((verse) => {
      simpleMap[verse.verse_key] = verse;
    });
    setSimpleVersesMap(simpleMap);
  }, []);

  return (
    <MyContext.Provider
      value={{
        quranSelection,
        setQuranSelection,
        verses,
        UthmaniVersesMap,
        SimpleVersesMap,
        answer,
        setAnswer,
        surahNames,
      }}
    >
      {children}
    </MyContext.Provider>
  );
};
