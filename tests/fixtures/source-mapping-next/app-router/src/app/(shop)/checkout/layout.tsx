export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <section>
      <button id="submit-order">Layout duplicate</button>
      {children}
    </section>
  );
}
