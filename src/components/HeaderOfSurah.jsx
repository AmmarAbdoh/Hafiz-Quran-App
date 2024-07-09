import React from "react";
import "../style/HeaderOfSurah.css";

const HeaderOfSurah = ({ surahName }) => {
  return (
    <div className="header-container">
      <div className="surah-name">{surahName}</div>
    </div>
  );
};

export default HeaderOfSurah;
