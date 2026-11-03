import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../styles/app.css";
import "../../styles/popup.css";
import { Popup } from "./Popup";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
