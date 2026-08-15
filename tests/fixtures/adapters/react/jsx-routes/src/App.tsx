import { Route, Routes } from "react-router-dom";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<div>Home</div>} />
      <Route path="/about" element={<div>About</div>} />
      <Route path="/contact" element={<div>Contact</div>} />
    </Routes>
  );
}
