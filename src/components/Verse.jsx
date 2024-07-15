import React from "react";
import { FaBook, FaLanguage, FaPlay } from "react-icons/fa";
import "../style/VerseStyle.css"; // Ensure the correct path

const Verse = ({ verse, isActive, onVerseClick }) => {
    return (
        <span className="verse-container">
            <span className={`quran-verse ${isActive ? "active-verse" : ""}`}
                onClick={onVerseClick}>
                {verse.aya_text}
            </span>
            {isActive && (
                <div className="verse-popup">
                    <button className="verse-popup-button">
                        <FaBook />
                    </button>
                    <button className="verse-popup-button">
                        <FaLanguage />
                    </button>
                    <button className="verse-popup-button">
                        <FaPlay />
                    </button>
                </div>
            )}
        </span>
    );
};

export default Verse;
