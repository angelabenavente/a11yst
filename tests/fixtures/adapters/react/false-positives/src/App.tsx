import { Link, Route, Routes } from "react-router-dom";

const API_USERS = "/api/users";
const LOGO = "/logo.svg";

export function App() {
  return (
    <div>
      <a href="/foo">Not a route</a>
      <Link to="/real">Real link target</Link>
      <img src={LOGO} alt="" />
      <code>{API_USERS}</code>
      <Routes>
        <Route path="/real" element={<div>Only real route</div>} />
      </Routes>
    </div>
  );
}
