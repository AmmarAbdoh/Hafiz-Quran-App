import React, { useState, useContext, useEffect } from "react";
import { Container, Nav } from "react-bootstrap";
import SurahSelection from "./SurahSelection";
import JuzSelection from "./JuzSelection";
import { MyContext } from "../useContext";
import QuranVerse from "../components/QuranVerse";

const CustomSettings = () => {
  const { quranSelection, setQuranSelection } = useContext(MyContext); // Assuming you only need to read quranSelection
  const [activeTab, setActiveTab] = useState("surah");

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  // Conditionally render the entire container based on quranSelection length
  if (quranSelection.length > 0) {
    return <QuranVerse quranSelection={quranSelection} />;
  }

  return (
    <Container className="tabs">
      <Nav variant="tabs" defaultActiveKey="surah" className="form-check">
        <Nav.Item>
          <Nav.Link eventKey="surah" onClick={() => handleTabChange("surah")}>
            اختيار السور
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="juz" onClick={() => handleTabChange("juz")}>
            اختيار الاجزاء
          </Nav.Link>
        </Nav.Item>
      </Nav>

      {/* Render tab content based on activeTab */}
      {activeTab === "surah" && <SurahSelection />}
      {activeTab === "juz" && <JuzSelection />}
    </Container>
  );
};

export default CustomSettings;
