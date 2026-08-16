import { Link, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { IssuesPage } from "./pages/IssuesPage";

export function App() {
  return (
    <div>
      <header>
        <h1>Framework React + Vite</h1>
        <nav aria-label="Primary">
          <Link to="/">Home</Link>
          {" | "}
          <Link to="/issues">Issues</Link>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/issues" element={<IssuesPage />} />
        </Routes>
      </main>
    </div>
  );
}
