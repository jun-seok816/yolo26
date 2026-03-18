import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { createRoot } from "react-dom/client";
import DatasetLoaderPage from "./component/DatasetLoaderPage";
import BoundingBoxWorkspaceModuleTestPage from "./component/module/BoundingBoxWorkspaceModuleTestPage";

export default function Root() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/upload" replace />} />
      <Route path="/upload" element={<DatasetLoaderPage />} />
      <Route path="/test" element={<BoundingBoxWorkspaceModuleTestPage />} />
    </Routes>
  );
}

const container = document.getElementById("app");
const root = createRoot(container!); // createRoot(container!) if you use TypeScript

root.render(
  <>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </>
);
