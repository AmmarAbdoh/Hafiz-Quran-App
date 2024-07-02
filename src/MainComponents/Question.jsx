import React, { useState, useEffect } from "react";
import FillTheBlank from "../QuestionsComponents/FillTheBlank";
import InfoQuestion from "../QuestionsComponents/InfoQuestion"; // Adjust the import path as necessary
import { fetchRandomAyah } from "../functions/RandomAyah"; // Adjust the import path as necessary

const Question = ({ quranSelection }) => {
  const [randomVerse, setRandomVerse] = useState(null);
  const [questionType, setQuestionType] = useState(null);

  const fetchNewRandomVerse = () => {
    fetchRandomAyah(quranSelection, setRandomVerse);
    // Randomly select between FillTheBlank and InfoQuestion
    const types = ["FillTheBlank", "InfoQuestion"];
    setQuestionType(types[Math.floor(Math.random() * types.length)]);
  };

  useEffect(() => {
    fetchNewRandomVerse();
  }, [quranSelection]);

  if (!randomVerse || !questionType) {
    return (
      <div className="tabs">
        <div>تحميل...</div>
      </div>
    );
  }

  return (
    <>
      {questionType === "FillTheBlank" && (
        <FillTheBlank
          verse={randomVerse}
          onNextQuestion={fetchNewRandomVerse}
        />
      )}
      {questionType === "InfoQuestion" && (
        <InfoQuestion
          verse={randomVerse}
          onNextQuestion={fetchNewRandomVerse}
        />
      )}
    </>
  );
};

export default Question;
