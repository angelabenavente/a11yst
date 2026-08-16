import "./CheckoutPage.css";

export function CheckoutPage() {
  return (
    <section>
      <h2>Checkout</h2>
      <p>Intentional violations across default, keyboard, large-text, and reduced-motion profiles.</p>

      {/* AXE VIOLATION (button-name) */}
      <button type="button" className="checkout-submit"></button>

      <p>
        <a href="/checkout" tabIndex={1}>
          Tabindex 1 checkout link
        </a>
      </p>

      <div className="clip-box">
        <p>Text clipped at 200% scale inside a fixed-height overflow hidden container.</p>
      </div>

      <div className="spinner" role="img" aria-label="Processing payment" />
    </section>
  );
}
