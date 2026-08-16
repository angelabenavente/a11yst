import { Component } from "@angular/core";

@Component({
  selector: "app-contact-page",
  standalone: true,
  template: `
    <section>
      <h2>Contact</h2>
      <p>This route intentionally includes a button with no accessible name.</p>
      <!-- AXE VIOLATION (button-name) -->
      <button type="button"></button>
    </section>
  `,
})
export class ContactPageComponent {}
