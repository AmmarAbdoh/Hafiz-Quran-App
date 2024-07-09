// src/App.jsx
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import "./App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import { Container, Row, Col } from "react-bootstrap";

// Import your components
import CustomTest from "./MainComponents/CustomTest";
import Quran from "./MainComponents/Quran";

document.body.classList.add("background-image-class");
const Home = () => {
  const navigate = useNavigate();
  return (
    <Container className="mt-5">
      <h1 className="text-center mb-4">حافظ القرآن</h1>
      <Row>
        <Col xs={12} md={6} className="mb-3">
          <button onClick={() => navigate("/quran")} className="mybtn w-100">
            القران الكريم
          </button>
        </Col>
        <Col xs={12} md={6} className="mb-3">
          <button
            onClick={() => navigate("/custom-test")}
            className="mybtn w-100"
          >
            اختبار مخصص
          </button>
        </Col>
        <Col xs={12} md={6} className="mb-3">
          <button
            onClick={() => navigate("/daily-challenge")}
            className="mybtn w-100"
          >
            التحدي اليومي
          </button>
        </Col>
        <Col xs={12} md={6} className="mb-3">
          <button
            onClick={() => navigate("/about-app")}
            className="mybtn w-100"
          >
            معلومات عن التطبيق
          </button>
        </Col>
      </Row>
    </Container>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/quran" element={<Quran />} />
      </Routes>
    </Router>
  );
}

export default App;
