import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import HomePage from "./pages/HomePage.vue";
import AccessibleMenuPage from "./pages/AccessibleMenuPage.vue";
import BadMenuPage from "./pages/BadMenuPage.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomePage },
    { path: "/accessible", name: "accessible", component: AccessibleMenuPage },
    { path: "/bad", name: "bad", component: BadMenuPage },
  ],
});

createApp(App).use(router).mount("#app");
