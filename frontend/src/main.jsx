import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CompRatesProvider } from "./context/CompRatesContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CompRatesProvider>
      <App />
    </CompRatesProvider>
  </React.StrictMode>
);