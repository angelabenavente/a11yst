import { Link, Route, Routes, useParams, useSearchParams } from "react-router-dom";
import { VariantPage, type RegressionVariant } from "./VariantPage";

const VARIANTS = new Set<RegressionVariant>(["baseline", "new", "resolved", "severity"]);

function normalizeVariant(value: string | undefined): RegressionVariant {
  return value && VARIANTS.has(value as RegressionVariant)
    ? (value as RegressionVariant)
    : "baseline";
}

function VariantRoute() {
  const { variant } = useParams();
  return <VariantPage variant={normalizeVariant(variant)} />;
}

function PlaygroundRoute() {
  const [params] = useSearchParams();
  return <VariantPage variant={normalizeVariant(params.get("variant") ?? undefined)} />;
}

export function App() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: "40rem", margin: "2rem auto" }}>
      <header>
        <h1>Baseline React regression</h1>
        <p>
          Switch variants via route (<code>/v/&lt;variant&gt;</code>) or query param
          (<code>?variant=&lt;variant&gt;</code>) without editing source during tests.
        </p>
        <nav aria-label="Regression variants">
          <Link to="/v/baseline">Baseline</Link>
          {" | "}
          <Link to="/v/new">New</Link>
          {" | "}
          <Link to="/v/resolved">Resolved</Link>
          {" | "}
          <Link to="/v/severity">Severity</Link>
          {" | "}
          <Link to="/?variant=new">Query: new</Link>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<PlaygroundRoute />} />
          <Route path="/v/:variant" element={<VariantRoute />} />
        </Routes>
      </main>
    </div>
  );
}
