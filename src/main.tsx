import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import OBR from "@owlbear-rodeo/sdk";

import App from "./components/App";
import Homepage from "./components/Homepage";
import "./index.css";

// OBR.isAvailable is true when Owlbear embedded this page (it adds ?obrref).
createRoot(document.getElementById("app")!).render(
  <StrictMode>{OBR.isAvailable ? <App /> : <Homepage />}</StrictMode>,
);
