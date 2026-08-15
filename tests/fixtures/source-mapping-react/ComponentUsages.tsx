import { CheckoutButton } from "./CheckoutButton";

export function ComponentUsages() {
  return (
    <>
      <CheckoutButton label="First" />
      <CheckoutButton label="Second" aria-label="Duplicate usage" />
      <UI.Button id="ui-button" aria-label="UI button" />
      <Form.ErrorMessage>Payment failed</Form.ErrorMessage>
      <CheckoutButton label="Third">Place order</CheckoutButton>
    </>
  );
}

function UI() {}
UI.Button = function UIButton() {
  return null;
};

function Form() {}
Form.ErrorMessage = function ErrorMessage({ children }: { children: string }) {
  return <p role="alert">{children}</p>;
};
