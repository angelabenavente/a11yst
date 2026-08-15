import { useMemo, useState } from "react";
import { products, type Product } from "./products";

type DrawerView = "cart" | "checkout" | "success";

interface CheckoutFields {
  name: string;
  email: string;
  card: string;
}

const emptyFields: CheckoutFields = {
  name: "",
  email: "",
  card: "",
};

function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function App() {
  const [cart, setCart] = useState<Product[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<DrawerView>("cart");
  const [fields, setFields] = useState<CheckoutFields>(emptyFields);
  const [errors, setErrors] = useState<string[]>([]);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price, 0),
    [cart],
  );

  function openDrawer(view: DrawerView = "cart") {
    setDrawerView(view);
    setDrawerOpen(true);
    // Intentionally skip moving focus into the drawer for dialog-focus-entry.
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setDrawerView("cart");
    setErrors([]);
  }

  function addToCart(product: Product) {
    setCart((items) => [...items, product]);
    openDrawer("cart");
  }

  function validateCheckout(values: CheckoutFields): string[] {
    const nextErrors: string[] = [];
    if (!values.name.trim()) {
      nextErrors.push("Full name is required.");
    }
    if (!values.email.trim()) {
      nextErrors.push("Email is required.");
    } else if (!values.email.includes("@")) {
      nextErrors.push("Email must include an @ symbol.");
    }
    if (!values.card.trim()) {
      nextErrors.push("Card number is required.");
    }
    return nextErrors;
  }

  function handlePlaceOrder() {
    const nextErrors = validateCheckout(fields);
    setErrors(nextErrors);
    if (nextErrors.length > 0) {
      // Intentionally keep focus on the submit control for form-error-focus-review.
      return;
    }
    setDrawerView("success");
    setCart([]);
    setFields(emptyFields);
    setErrors([]);
  }

  const cartLabel =
    cart.length === 0 ? "Open cart" : `Open cart (${cart.length} items)`;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>a11yst Shop</h1>
          <p>Minimal checkout fixture for a11yst flow audits.</p>
        </div>
        <button type="button" className="cart-trigger" onClick={() => openDrawer("cart")}>
          {cartLabel}
        </button>
      </header>

      <section aria-labelledby="products-heading">
        <h2 id="products-heading">Products</h2>
        <ul className="product-list">
          {products.map((product) => (
            <li key={product.id} className="product-card">
              {/* AXE VIOLATION (image-alt): product photo is missing alt text. */}
              <img className="product-thumb" src={`data:image/svg+xml,${encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#bfdbfe"/></svg>`,
              )}`} />
              <div className="product-copy">
                <h3>{product.name}</h3>
                <p className="product-description">{product.description}</p>
                <p>{formatPrice(product.price)}</p>
              </div>
              <button
                type="button"
                className="add-to-cart"
                onClick={() => addToCart(product)}
              >
                Add {product.name} to cart
              </button>
            </li>
          ))}
        </ul>
      </section>

      {drawerOpen ? (
        <>
          <div className="drawer-backdrop" onClick={closeDrawer} />
          <aside
            className="cart-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-drawer-title"
          >
            <div className="drawer-header">
              <h2 id="cart-drawer-title">
                {drawerView === "success" ? "Order confirmed" : "Your cart"}
              </h2>
              <button type="button" className="drawer-close" onClick={closeDrawer}>
                Close cart
              </button>
            </div>

            {drawerView === "cart" ? (
              <>
                {cart.length === 0 ? (
                  <p>Your cart is empty.</p>
                ) : (
                  <>
                    <ul className="cart-items">
                      {cart.map((item, index) => (
                        <li key={`${item.id}-${index}`} className="cart-item">
                          <span>{item.name}</span>
                          <span>{formatPrice(item.price)}</span>
                        </li>
                      ))}
                    </ul>
                    <p>
                      <strong>Total: {formatPrice(total)}</strong>
                    </p>
                    <button
                      type="button"
                      className="proceed-checkout"
                      onClick={() => setDrawerView("checkout")}
                    >
                      Proceed to checkout
                    </button>
                  </>
                )}
              </>
            ) : null}

            {drawerView === "checkout" ? (
              <form
                className="checkout-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  handlePlaceOrder();
                }}
              >
                <label htmlFor="checkout-name">
                  Full name
                  <input
                    id="checkout-name"
                    type="text"
                    autoComplete="name"
                    value={fields.name}
                    onChange={(event) =>
                      setFields((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </label>
                <label htmlFor="checkout-email">
                  Email
                  <input
                    id="checkout-email"
                    type="email"
                    autoComplete="email"
                    value={fields.email}
                    onChange={(event) =>
                      setFields((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </label>
                {/* Missing visible label: only placeholder text for card number. */}
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  aria-label="Card number"
                  placeholder="Card number"
                  value={fields.card}
                  onChange={(event) =>
                    setFields((current) => ({ ...current, card: event.target.value }))
                  }
                />

                {errors.length > 0 ? (
                  <div className="validation-errors" role="alert">
                    <p>Please fix the following:</p>
                    <ul>
                      {errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="form-actions">
                  <button type="submit" className="place-order">
                    Place order
                  </button>
                  {/* AXE VIOLATION (button-name): promo toggle has no accessible name. */}
                  <button type="button" className="promo-toggle" />
                </div>
              </form>
            ) : null}

            {drawerView === "success" ? (
              <div className="success-message" role="status">
                <p>Thanks! Your order is on its way.</p>
                <p>Confirmation sent to the email you provided.</p>
                <div className="processing-spinner" role="img" aria-label="Processing order" />
              </div>
            ) : null}
          </aside>
        </>
      ) : null}
    </div>
  );
}
