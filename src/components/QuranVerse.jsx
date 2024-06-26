import React, { useState, useEffect } from "react";
import { Container } from "react-bootstrap";

const QuranVerse = ({ quranSelection }) => {
  console.log("hiii");
  const [randomVerse, setRandomVerse] = useState(null);
  useEffect(() => {
    if (quranSelection && quranSelection.length > 0) {
      const trueIndexes = [];

      // Collect positions of true values in quranSelection
      quranSelection.forEach((value, index) => {
        if (value) {
          trueIndexes.push(index + 1); // +1 to convert to 1-based index
        }
      });

      const lastItem = quranSelection[quranSelection.length - 1];
      const selectionType = lastItem ? "سورة" : "جزء"; // Determine if it's surah or juz

      if (!lastItem) {
        // Select a random juz index from trueIndexes array
        const randomIndex = Math.floor(Math.random() * trueIndexes.length);
        const juzIndex = trueIndexes[randomIndex]; // Get the selected juz index from trueIndexes array

        // Asynchronous function to fetch and set random verse
        const fetchAndSetRandomVerse = async () => {
          try {
            const response = await fetch(
              `/public/Quran/Juzs/juz_${juzIndex}.json`
            );
            const juzData = await response.json();

            // Generate a random index within the range of verses in the juz
            const randomVerseIndex = Math.floor(
              Math.random() * juzData.verses.length
            );
            const randomVerse = juzData.verses[randomVerseIndex];

            // Update state with the random verse
            setRandomVerse(randomVerse);
          } catch (error) {
            console.error("Error fetching or parsing juz data:", error);
            // You may want to handle errors here, e.g., display a message or retry
          }
        };

        // Call async function to fetch and set random verse
        fetchAndSetRandomVerse();
      }
    }
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
    </Container>
  );
};

export default QuranVerse;
