import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import HomePage from "./pages/HomePage.vue";
import IssuesPage from "./pages/IssuesPage.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomePage },
    { path: "/issues", name: "issues", component: IssuesPage },
  ],
});

createApp(App).use(router).mount("#app");
