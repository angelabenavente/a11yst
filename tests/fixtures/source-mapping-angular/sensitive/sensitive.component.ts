
@Component({
  selector: "app-sensitive",
  template: `
    <input name="password" value="Password123!" />
    <input name="token" value="Bearer secret-token" />
    <input name="cookie" value="session=abc" />
    <input name="authorization" value="Basic xyz" />
    <input name="email" value="user@example.com" />
    <a href="javascript:alert(1)">Click</a>
    <button (click)="handler()">Save</button>
    <div [innerHTML]="content"></div>
  `,
})
export class SensitiveComponent {
  handler() {}
  content = "";
}
