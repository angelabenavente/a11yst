import { Routes } from "@angular/router";
import { ContactPageComponent } from "./pages/contact-page.component";
import { HomePageComponent } from "./pages/home-page.component";

export const routes: Routes = [
  { path: "", component: HomePageComponent },
  { path: "contact", component: ContactPageComponent },
];
