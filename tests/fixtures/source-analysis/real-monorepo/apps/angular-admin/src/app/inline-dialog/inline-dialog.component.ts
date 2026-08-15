import { Component } from "@angular/core";

@Component({
  selector: "app-inline-dialog",
  template: `
    <div role="dialog" aria-labelledby="dialog-title">
      <h2 id="dialog-title">Review payment</h2>
      <button id="inline-close" type="button" aria-label="Close dialog">Close</button>
    </div>
  `,
})
export class InlineDialogComponent {}
