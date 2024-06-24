import React, { useState } from "react";
import { Container, Row, Col, Nav } from "react-bootstrap";
import SurahSelection from "./SurahSelection";
import JuzSelection from "./JuzSelection";

const CustomSettings = () => {
  const [activeTab, setActiveTab] = useState("surah");

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

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
