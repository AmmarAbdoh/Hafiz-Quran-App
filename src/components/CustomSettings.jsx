import React, { useState, useContext, useEffect } from "react";
import { Container, Nav } from "react-bootstrap";
import SurahSelection from "./SurahSelection";
import JuzSelection from "./JuzSelection";
import { MyContext } from "../useContext";
import { useLocation } from "react-router-dom";
import QuranVerse from "../components/QuranVerse";
import Question from "../MainComponents/Question";

const CustomSettings = () => {
  const { quranSelection, setQuranSelection } = useContext(MyContext);
  const [activeTab, setActiveTab] = useState("surah");
  const location = useLocation();

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  useEffect(() => {
    console.log("location changed", location);
    setQuranSelection([]);
  }, [location, setQuranSelection]);

  if (quranSelection.length > 0) {
    return <Question quranSelection={quranSelection} />;
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

      {activeTab === "surah" && <SurahSelection />}
      {activeTab === "juz" && <JuzSelection />}
    </Container>
  );
};

export default CustomSettings;
