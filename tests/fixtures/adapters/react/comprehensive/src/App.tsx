import { Route, Routes } from "react-router-dom";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<div>Home</div>} />
      <Route path="/about" element={<div>About</div>} />
      <Route path="/projects">
        <Route index element={<div>Projects</div>} />
        <Route path="featured" element={<div>Featured</div>} />
      </Route>
      <Route path="/projects/:slug" element={<div>Project detail</div>} />
      <Route path="/contact" element={<div>Contact</div>} />
    </Routes>
  );
}
