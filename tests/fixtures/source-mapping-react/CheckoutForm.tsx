import { CheckoutButton } from "./CheckoutButton";

const items = ["apple", "banana"];

export const CheckoutForm = () => (
  <>
    <form>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" />
      <button type="submit">Continue</button>
      <button type="button">Continue</button>
      <p role="alert">Invalid card number</p>
    </form>
    <CheckoutButton label="Dynamic label" />
    {items.length > 0 ? <button id="ternary-save">Save</button> : <span>Empty</span>}
    {items.map((item) => (
      <button key={item} data-testid={`item-${item}`}>
        {item}
      </button>
    ))}
    <>
      <span>Fragment wrapper</span>
    </>
  </>
);
