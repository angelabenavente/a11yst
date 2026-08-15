
@Component({
  selector: "app-inline-checkout",
  template: `
    <section>
      <button
        id="inline-submit"
        aria-label="Place order"
      >
        Place order
      </button>
      <span><strong>Save</strong></span>
    </section>
  `,
  standalone: true,
})
export class InlineCheckoutComponent {}
