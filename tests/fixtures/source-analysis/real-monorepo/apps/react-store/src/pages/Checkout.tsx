import { CheckoutButton } from "../components/CheckoutButton";

export function CheckoutPage() {
  return (
    <main>
      <h1>Checkout</h1>
      <CheckoutButton />
      <button id="shared-submit" type="button">
        Shared submit
      </button>
    </main>
  );
}
