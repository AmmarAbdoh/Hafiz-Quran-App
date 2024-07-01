import React, { useState, useEffect, useContext } from "react";
import { Container } from "react-bootstrap";
import { fetchPrevAndNextVerse } from "../functions/PrevAndNextVerse";
import { MyContext } from "../useContext";
import SearchForVerse from "./SearchForVerse";

const FillTheBlank = ({ verse, onNextQuestion }) => {
  const [prevAndNextVerse, setPrevAndNextVerse] = useState([null, null]);
  const [loading, setLoading] = useState(true);
  const [hiddenVerseIndex, setHiddenVerseIndex] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [coveredVerse, setCoveredVerse] = useState(null); // State to track covered verse
  const { SimpleVersesMap } = useContext(MyContext);

  useEffect(() => {
    const getPrevAndNextVerse = async () => {
      const result = await fetchPrevAndNextVerse(verse);
      setPrevAndNextVerse(result);
      setLoading(false);
    };

    getPrevAndNextVerse();
  }, [verse]);

  useEffect(() => {
    // Randomly hide one of the verses: 0 = prev, 1 = current, 2 = next
    const getRandomIndex = () => Math.floor(Math.random() * 3);
    let randomIndex = getRandomIndex();

    // Ensure nextVerse or prevVerse is not null
    while (
      (randomIndex === 0 && !prevAndNextVerse[0]) ||
      (randomIndex === 1 && !verse) ||
      (randomIndex === 2 && !prevAndNextVerse[1])
    ) {
      randomIndex = getRandomIndex();
    }

    setHiddenVerseIndex(randomIndex);
  }, [prevAndNextVerse, verse]);

  // Effect to update covered verse whenever hiddenVerseIndex changes
  useEffect(() => {
    if (hiddenVerseIndex === 0) {
      setCoveredVerse(prevAndNextVerse[0]);
    } else if (hiddenVerseIndex === 1) {
      setCoveredVerse(verse);
    } else if (hiddenVerseIndex === 2) {
      setCoveredVerse(prevAndNextVerse[1]);
    }
  }, [hiddenVerseIndex, prevAndNextVerse, verse]);

  // Function to handle selection from SearchForVerse component
  const handleSelection = (selectedVerse) => {
    if (
      coveredVerse &&
      SimpleVersesMap[selectedVerse.verse_key].text_imlaei ===
        SimpleVersesMap[coveredVerse.verse_key].text_imlaei
    ) {
      setIsCorrect(true); // Set correct if answers match
    } else {
      setIsCorrect(false); // Set incorrect if answers do not match
    }
  };

  // Effect to trigger handleSelection when answer changes
  useEffect(() => {
    if (answer !== null) {
      handleSelection(answer);
    }
  }, [answer, coveredVerse]);

  // Reset state variables when verse changes
  useEffect(() => {
    const resetState = () => {
      setPrevAndNextVerse([null, null]);
      setLoading(true);
      setHiddenVerseIndex(null);
      setIsCorrect(null);
      setAnswer(null);
      setCoveredVerse(null);
    };

    resetState();
  }, [verse]);

  if (loading) {
    return (
      <Container>
        <div>تحميل...</div>
      </Container>
    );
  }

  const [prevVerse, nextVerse] = prevAndNextVerse;
  const verseText = verse.text_uthmani;
  const verseKey = verse.verse_key;
  const verseAyahNumber = verseKey.split(":")[1];

  const getHiddenText = (verseKey) => {
    const verse = SimpleVersesMap[verseKey];
    if (!verse) return "";

    return "_".repeat(verse.text_imlaei.length);
  };

  const getTextStyle = () => {
    if (isCorrect === null) return {};
    return { color: isCorrect ? "green" : "red" };
  };

  return (
    <Container dir="rtl">
      {hiddenVerseIndex !== 0 && prevVerse && (
        <span>
          <span className="verse-text">{prevVerse.text_uthmani}</span>
          <span className="verse-number">
            {prevVerse.verse_key.split(":")[1]}
          </span>
        </span>
      )}
      {hiddenVerseIndex === 0 && prevVerse && (
        <span>
          <span className="verse-text" style={getTextStyle()}>
            {isCorrect === null
              ? getHiddenText(prevVerse.verse_key)
              : prevVerse.text_uthmani}
          </span>
          <span className="verse-number">
            {prevVerse.verse_key.split(":")[1]}
          </span>
        </span>
      )}
      {hiddenVerseIndex !== 1 && (
        <span>
          <span className="verse-text">{verseText}</span>
          <span className="verse-number">{verseAyahNumber}</span>
        </span>
      )}
      {hiddenVerseIndex === 1 && (
        <span>
          <span className="verse-text" style={getTextStyle()}>
            {isCorrect === null ? getHiddenText(verseKey) : verseText}
          </span>
          <span className="verse-number">{verseAyahNumber}</span>
        </span>
      )}
      {hiddenVerseIndex !== 2 && nextVerse && (
        <span>
          <span className="verse-text">{nextVerse.text_uthmani}</span>
          <span className="verse-number">
            {nextVerse.verse_key.split(":")[1]}
          </span>
        </span>
      )}
      {hiddenVerseIndex === 2 && nextVerse && (
        <span>
          <span className="verse-text" style={getTextStyle()}>
            {isCorrect === null
              ? getHiddenText(nextVerse.verse_key)
              : nextVerse.text_uthmani}
          </span>
          <span className="verse-number">
            {nextVerse.verse_key.split(":")[1]}
          </span>
        </span>
      )}

      {isCorrect == null && <SearchForVerse setAnswer={setAnswer} />}

      {isCorrect !== null && (
        <div className="feedback mt-5">
          {isCorrect ? (
            <h3 style={{ color: "green" }}>صحيح! بارك الله فيك!</h3>
          ) : (
            <h3 style={{ color: "red" }}>اجابة خاطئة.</h3>
          )}
          <button className="mybtn mt-3" onClick={onNextQuestion}>
            السؤال التالي
          </button>
        </div>
      )}
    </Container>
  );
};

export default FillTheBlank;
