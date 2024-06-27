import React, { useState, useEffect } from "react";
import { Container } from "react-bootstrap";
import { fetchQuranData } from "../functions/QuranUthmani";

const FillTheBlank = ({ verse }) => {
  const [quranData, setQuranData] = useState([]);
  const [prevVerse, setPrevVerse] = useState(null);
  const [nextVerse, setNextVerse] = useState(null);

  const verseText = verse.text_uthmani;
  const verseKey = verse.verse_key;
  const verseID = verse.id;
  const verseSurahNumber = verseKey.split(":")[0];
  const verseAyahNumber = verseKey.split(":")[1];

  useEffect(() => {
    const loadQuranData = async () => {
      const data = await fetchQuranData();
      setQuranData(data);
    };

    loadQuranData();
  }, []);

  useEffect(() => {
    if (quranData.length > 0 && verse) {
      const currentVerseIndex = quranData.findIndex((v) => v.id === verseID);

      // Find previous verse in the same Surah
      if (
        currentVerseIndex > 0 &&
        quranData[currentVerseIndex - 1].verse_key.startsWith(verseSurahNumber)
      ) {
        setPrevVerse(quranData[currentVerseIndex - 1]);
      } else {
        setPrevVerse(null);
      }

      // Find next verse in the same Surah
      if (
        currentVerseIndex < quranData.length - 1 &&
        quranData[currentVerseIndex + 1].verse_key.startsWith(verseSurahNumber)
      ) {
        setNextVerse(quranData[currentVerseIndex + 1]);
      } else {
        setNextVerse(null);
      }
    }
  }, [quranData, verse, verseID, verseSurahNumber]);

  if (!verse) {
    return (
      <Container>
        <div>Loading...</div>
      </Container>
    );
  }

  return (
    <Container>
      {prevVerse && (
        <div>
          <span className="verse-number">
            {prevVerse.verse_key.split(":")[1]}
          </span>
          <span className="verse-text">{prevVerse.text_uthmani}</span>
        </div>
      )}
      <div>
        <span className="verse-number">{verseAyahNumber}</span>
        <span className="verse-text">{verseText}</span>
      </div>
      {nextVerse && (
        <div>
          <span className="verse-number">
            {nextVerse.verse_key.split(":")[1]}
          </span>
          <span className="verse-text">{nextVerse.text_uthmani}</span>
        </div>
      )}
    </Container>
  );
};

export default FillTheBlank;
