import { Link, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { SettingsPage } from "./pages/SettingsPage";

export function App() {
  return (
    <div>
      <header>
        <h1>React Basic</h1>
        <nav>
          <Link to="/">Home</Link>
          {" | "}
          <Link to="/settings">Settings</Link>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
