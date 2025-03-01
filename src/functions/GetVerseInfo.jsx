import QuranInfo from "../Quran/Chapters_Info/Quran_info.json";

const GetVerseInfo = ({ verseID, surahNames }) => {
  const findVerseByKey = (key) => {
    const verse = QuranInfo.find((v) => v.id === key);
    console.log("🚀 ~ GetVerseInfo ~ verseID:", verseID);
    console.log("🚀 ~ findVerseByKey ~ QuranInfo:", QuranInfo);
    console.log("🚀 ~ findVerseByKey ~ verse:", verse);
    return verse;
  };

  const verseInfo = findVerseByKey(verseID);

  if (!verseInfo) {
    return [];
  }

  const verseSurahNumber = parseInt(verseInfo.verse_key.split(":")[0], 10);

  // Return the verse information in an array
  return [
    {
      key: "اسم السورة",
      value: surahNames[verseSurahNumber - 1],
    },
    {
      key: "رقم الاية",
      value: verseInfo.verse_number,
    },
    {
      key: "رقم الجزء",
      value: verseInfo.juz_number,
    },
    {
      key: "رقم الحزب",
      value: verseInfo.hizb_number,
    },
    {
      key: "الصفحة",
      value: verseInfo.page_number,
    },
  ];
};

export default GetVerseInfo;
