import { Link, Route, Routes } from "react-router-dom";
import { CheckoutPage } from "./pages/CheckoutPage";
import { HomePage } from "./pages/HomePage";

export function App() {
  return (
    <div>
      <header>
        <h1>Multi-profile React</h1>
        <nav aria-label="Primary">
          <Link to="/">Home</Link>
          {" | "}
          <Link to="/checkout">Checkout</Link>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
        </Routes>
      </main>
    </div>
  );
}
