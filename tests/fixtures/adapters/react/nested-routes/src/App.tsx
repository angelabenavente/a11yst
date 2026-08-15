import { Route, Routes } from "react-router-dom";

export function App() {
  return (
    <Routes>
      <Route path="/projects">
        <Route path="featured" element={<div>Featured</div>} />
        <Route index element={<div>Projects home</div>} />
      </Route>
      <Route path="/contact" element={<div>Contact</div>} />
    </Routes>
  );
}
