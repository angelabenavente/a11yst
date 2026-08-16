import { Component } from "@angular/core";
import { RouterLink, RouterOutlet } from "@angular/router";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  template: `
    <header>
      <h1>Framework Angular</h1>
      <nav aria-label="Primary">
        <a routerLink="/">Home</a>
        |
        <a routerLink="/contact">Contact</a>
      </nav>
    </header>
    <main>
      <router-outlet />
    </main>
  `,
})
export class AppComponent {}
