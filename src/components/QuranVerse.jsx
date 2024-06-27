import React, { useState, useEffect } from "react";
import { Container } from "react-bootstrap";
import { fetchRandomAyah } from "../functions/RandomAyah"; // Adjust the import path as necessary

const QuranVerse = ({ quranSelection }) => {
  const [randomVerse, setRandomVerse] = useState(null);

  useEffect(() => {
    fetchRandomAyah(quranSelection, setRandomVerse);
  }, [quranSelection]);

  // Render loading state or the random verse
  if (!randomVerse) {
    return (
      <Container className="tabs">
        <div>تحميل...</div>
      </Container>
    );
  }

  return (
    <Container className="tabs">
      <div>الآية العشوائية: {randomVerse.text_uthmani}</div>
      <div>{randomVerse.verse_key}</div>
    </Container>
  );
};

export default QuranVerse;
