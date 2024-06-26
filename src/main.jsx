import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "./style/CustomSettings.css";
import "./style/QuranStyle.css";
import { MyProvider } from "./useContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <MyProvider>
    <App />
  </MyProvider>
);
