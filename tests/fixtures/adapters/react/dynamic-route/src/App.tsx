import { Route, Routes } from "react-router-dom";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<div>Home</div>} />
      <Route path="/projects/:slug" element={<div>Project</div>} />
      <Route path="/users/:id" element={<div>User</div>} />
    </Routes>
  );
}
