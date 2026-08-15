
@Component({
  selector: "app-checkout-button",
  template: `<button>Child</button>`,
})
export class CheckoutButtonComponent {}

@Component({
  selector: "app-payment-dialog",
  template: `<div>Dialog</div>`,
})
export class PaymentDialogComponent {}

@Component({
  selector: "app-usages-owner",
  template: `
    <app-checkout-button></app-checkout-button>
    <app-payment-dialog></app-payment-dialog>
    <app-checkout-button></app-checkout-button>
  `,
})
export class UsagesOwnerComponent {}
