export function CheckoutButton() {
  return (
    <button
      id="react-submit-order"
      className="btn btn-primary"
      aria-label="Place order"
      data-testid="checkout-button"
      type="submit"
    >
      Place order
      now
    </button>
  );
}
