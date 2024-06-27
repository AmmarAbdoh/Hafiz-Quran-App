import React, { useState, useEffect } from "react";
import FillTheBlank from "../QuestionsComponents/FillTheBlank";
import { fetchRandomAyah } from "../functions/RandomAyah"; // Adjust the import path as necessary

const Question = ({ quranSelection }) => {
  const [randomVerse, setRandomVerse] = useState(null);
  useEffect(() => {
    fetchRandomAyah(quranSelection, setRandomVerse);
  }, [quranSelection]);

  if (!randomVerse) {
    return (
      <div className="tabs">
        <div>تحميل...</div>
      </div>
    );
  }

  return <FillTheBlank verse={randomVerse}></FillTheBlank>;
};
export default Question;
