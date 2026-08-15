export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <section>
      <button id="next-shared-action" type="button">
        Continue in layout
      </button>
      {children}
    </section>
  );
}
