import { Link, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { BrokenPage } from "./pages/BrokenPage";

export function App() {
  return (
    <div>
      <header>
        <h1>Audit Example — React</h1>
        <nav aria-label="Section">
          <Link to="/">Home</Link>
          {" | "}
          <Link to="/broken">Broken</Link>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/broken" element={<BrokenPage />} />
        </Routes>
      </main>
    </div>
  );
}
