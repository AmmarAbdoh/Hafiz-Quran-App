import React, { useState, useEffect } from "react";
import FillTheBlank from "../QuestionsComponents/FillTheBlank";
import { fetchRandomAyah } from "../functions/RandomAyah"; // Adjust the import path as necessary

const Question = ({ quranSelection }) => {
  const [randomVerse, setRandomVerse] = useState(null);

  const fetchNewRandomVerse = () => {
    fetchRandomAyah(quranSelection, setRandomVerse);
  };

  useEffect(() => {
    fetchNewRandomVerse();
  }, [quranSelection]);

  if (!randomVerse) {
    return (
      <div className="tabs">
        <div>تحميل...</div>
      </div>
    );
  }

  return (
    <FillTheBlank verse={randomVerse} onNextQuestion={fetchNewRandomVerse} />
  );
};

export default Question;
