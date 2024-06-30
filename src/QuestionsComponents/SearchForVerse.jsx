import React, { useState, useContext } from "react";
import { MyContext } from "../useContext";
import "../style/SearchForVerse.css";

const SearchForVerse = ({ setAnswer }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState(null); // State to hold the selected verse temporarily
  const { verses } = useContext(MyContext);

  // Function to filter and sort suggestions
  const filteredVerses = verses
    .filter(
      (verse) => searchTerm !== "" && verse.text_imlaei.includes(searchTerm)
    )
    .sort((a, b) => a.text_imlaei.length - b.text_imlaei.length);

  // Function to handle selection
  const handleSelectVerse = (verse) => {
    setSelectedVerse(verse); // Store the selected verse temporarily
    setShowDropdown(false); // Close dropdown
  };

  // Function to confirm the selected verse
  const confirmSelection = () => {
    if (selectedVerse) {
      setAnswer(selectedVerse); // Set the selected verse as the final answer
      setSelectedVerse(null); // Clear the selected verse from temporary state
      setSearchTerm(""); // Clear search term
    }
  };

  return (
    <div className="search-container mt-5">
      <input
        className="input-field"
        type="text"
        placeholder="ابحث عن الاية..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setShowDropdown(e.target.value !== "");
        }}
        onFocus={() => setShowDropdown(searchTerm !== "")}
      />
      {showDropdown && (
        <div className="dropdown">
          {filteredVerses.slice(0, 4).map((verse) => (
            <div
              key={verse.id}
              className="dropdown-item"
              onClick={() => handleSelectVerse(verse)}
            >
              {verse.text_imlaei}
            </div>
          ))}
        </div>
      )}
      {selectedVerse && (
        <div className="selected-verse">
          <h6 className="mb-3">الاية المختارة</h6>
          <h5>{selectedVerse.text_imlaei}</h5>
          <button className="btn btn-success mt-3" onClick={confirmSelection}>
            تأكيد الاختيار
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchForVerse;
