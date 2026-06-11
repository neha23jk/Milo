import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { DashboardApp } from "./apps/dashboard/DashboardApp";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <DashboardApp />
  </React.StrictMode>,
);
