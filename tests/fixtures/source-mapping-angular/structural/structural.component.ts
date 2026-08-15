
@Component({
  selector: "app-structural",
  template: `
    <ng-container>
      <button id="inside-container">Inside container</button>
    </ng-container>
    <ng-template>
      <button id="inside-template">Inside template</button>
    </ng-template>
    <ng-content></ng-content>
  `,
})
export class StructuralComponent {}
