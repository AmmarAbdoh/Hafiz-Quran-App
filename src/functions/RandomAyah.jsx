// fetchRandomAyah.js
export const fetchRandomAyah = async (quranSelection, setRandomVerse) => {
  try {
    const trueIndexes = [];

    // Collect positions of true values in quranSelection
    quranSelection.forEach((value, index) => {
      if (value && index !== 114) {
        trueIndexes.push(index + 1); // +1 to convert to 1-based index
      }
    });

    if (trueIndexes.length === 0) {
      console.warn("No true values found in quranSelection.");
      return;
    }

    const lastItem = quranSelection[quranSelection.length - 1];
    let JuzOrSurahPath = "";

    // Select a random juz/surah index from trueIndexes array
    const randomIndex = Math.floor(Math.random() * trueIndexes.length);
    const verseIndex = trueIndexes[randomIndex]; // Get the selected juz/surah index from trueIndexes array
    if (!lastItem) {
      JuzOrSurahPath = `/public/Quran/Juzs/juz_${verseIndex}.json`;
    } else {
      JuzOrSurahPath = `/public/Quran/Chapters_Uthmani/chapter_${verseIndex}.json`;
    }

    // Fetch and set random verse
    const response = await fetch(JuzOrSurahPath);
    const QuranData = await response.json();

    // Generate a random index within the range of verses in the juz or surah
    const randomVerseIndex = Math.floor(
      Math.random() * QuranData.verses.length
    );
    const randomVerse = QuranData.verses[randomVerseIndex];

    // Update state with the random vers
    console.log(QuranData);
    setRandomVerse(randomVerse);
  } catch (error) {
    console.error("Error fetching or parsing Quran data:", error);
  }
};
