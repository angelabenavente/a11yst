type CheckoutButtonProps = {
  label: string;
  buttonProps?: Record<string, unknown>;
};

export function CheckoutButton({ label, buttonProps }: CheckoutButtonProps) {
  return (
    <>
      <button
        {...buttonProps}
        id="submit-order"
        className="btn btn-primary"
        aria-label="Place order"
        data-testid="checkout-button"
        disabled={false}
      >
        Place order
      </button>
      <button id="save" {...buttonProps}>
        Save draft
      </button>
      <button className="btn unicode" title={`Static title`} tabIndex={-1}>
        {"Place order"} <span>🛒</span>
      </button>
      <button>{label}</button>
    </>
  );
}
