import React, { useState } from "react";
import { FaBook, FaLanguage, FaPlay } from "react-icons/fa";
import "../style/VerseStyle.css"; // Ensure the correct path
import TafseerModal from "./TafseerModal";

const Verse = ({ verse, isActive, onVerseClick }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleTafseerClick = () => {
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    return (
        <span className="verse-container">
            <span
                className={`quran-verse ${isActive ? "active-verse" : ""}`}
                onClick={onVerseClick}
            >
                {verse.aya_text}
            </span>
            {isActive && (
                <div className="verse-popup">
                    <button className="verse-popup-button" title="تفسير" onClick={handleTafseerClick}>
                        <FaBook />
                    </button>
                    <button className="verse-popup-button" title="ترجمة">
                        <FaLanguage />
                    </button>
                    <button className="verse-popup-button" title="تشغيل الاية">
                        <FaPlay />
                    </button>
                </div>
            )}
            {isModalOpen && <TafseerModal show={isModalOpen} onHide={closeModal} verse={verse} />}
        </span>
    );
};

export default Verse;
