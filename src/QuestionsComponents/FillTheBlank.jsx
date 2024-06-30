import React, { useState, useEffect } from "react";
import { Container } from "react-bootstrap";
import { fetchPrevAndNextVerse } from "../functions/PrevAndNextVerse";
import SearchForVerse from "./SearchForVerse";

const FillTheBlank = ({ verse }) => {
  const [prevAndNextVerse, setPrevAndNextVerse] = useState([null, null]);
  const [loading, setLoading] = useState(true);
  const [hiddenVerseIndex, setHiddenVerseIndex] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [coveredVerse, setCoveredVerse] = useState(null); // State to track covered verse

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
    console.log(selectedVerse.verse_key, coveredVerse?.verse_key);
    if (coveredVerse && selectedVerse.verse_key === coveredVerse.verse_key) {
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
          <span className="verse-text">_________</span>
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
          <span className="verse-text">_________</span>
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
          <span className="verse-text">_________</span>
          <span className="verse-number">
            {nextVerse.verse_key.split(":")[1]}
          </span>
        </span>
      )}

      <SearchForVerse setAnswer={setAnswer} />

      {isCorrect !== null && (
        <div className="feedback mt-3">
          {isCorrect ? (
            <h4 className="correct-text">صحيح! بارك الله فيك!</h4>
          ) : (
            <h4 className="wrong-text ">خطأ! حاول مرة أخرى.</h4>
          )}
        </div>
      )}
    </Container>
  );
};

export default FillTheBlank;
