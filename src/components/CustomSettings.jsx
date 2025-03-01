import { useState, useContext, useEffect } from "react";
import { Container, Nav } from "react-bootstrap";
import { useNavigate, useLocation } from "react-router-dom";
import SurahSelection from "./SurahSelection";
import JuzSelection from "./JuzSelection";
import { MyContext } from "../useContext";
import Question from "../MainComponents/Question";

const CustomSettings = () => {
  const { quranSelection, setQuranSelection } = useContext(MyContext);
  const [activeTab, setActiveTab] = useState("surah");
  const location = useLocation();
  const navigate = useNavigate();

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  useEffect(() => {
    console.log("location changed", location);
    setQuranSelection([]);
  }, [location, setQuranSelection]);

  const handleBackToHome = () => {
    navigate("/");
  };

  if (quranSelection.length > 0) {
    return <Question quranSelection={quranSelection} />;
  }

  return (
    <Container className="custom-container">
      <Container className="custom-settings">
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
        <button className="mybtn mt-3 mb-5" onClick={handleBackToHome}>
          العودة الى الصفحة الرئيسية
        </button>

        {activeTab === "surah" && <SurahSelection />}
        {activeTab === "juz" && <JuzSelection />}
      </Container>
    </Container>
  );
};

export default CustomSettings;
