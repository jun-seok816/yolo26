import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { createRoot } from "react-dom/client";
import DatasetLoaderPage from "./component/DatasetLoaderPage";

export default function Root() {
  return (
    <Routes>
      <Route path="/" element={<DatasetLoaderPage />} />
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
