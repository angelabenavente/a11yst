import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  const issuesPage = window.location.pathname === "/issues";

  return (
    <>
      <header>
        <a className="brand" href="/">a11yst responsive fixture</a>
        <nav aria-label="Example pages">
          <a href="/">Home</a>
          <a href="/issues">Issues</a>
        </nav>
      </header>
      <main>
        {issuesPage ? (
          <>
            <h1>Responsive accessibility issues</h1>
            <p>This intentionally large button has no accessible name.</p>
            <button className="unnamed-button" type="button"></button>
          </>
        ) : (
          <>
            <h1>Accessible responsive home</h1>
            <p>The same app adapts its layout at mobile and desktop widths.</p>
          </>
        )}
      </main>
    </>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found.");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
