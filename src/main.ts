import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// ✅ Make sure you have a root element in your index.html with id="root"
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
