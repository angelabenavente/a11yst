
@Component({
  selector: "app-bindings",
  template: `
    <button [id]="buttonId" [attr.aria-label]="label" [class.active]="active" [ngClass]="classes" (click)="submit()" [(ngModel)]="email">
      {{ label }}
    </button>
    <button class="static-class" aria-label="Static label">Static</button>
    <div *ngIf="visible">Conditional</div>
    <li *ngFor="let item of items">{{ item }}</li>
  `,
})
export class BindingsComponent {}
