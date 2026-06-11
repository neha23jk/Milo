import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { PetApp } from "./apps/pet/PetApp";

ReactDOM.createRoot(document.getElementById("pet-root") as HTMLElement).render(
  <React.StrictMode>
    <PetApp />
  </React.StrictMode>,
);
