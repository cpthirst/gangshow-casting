import { createRouter, createWebHistory, type RouterHistory } from "vue-router";
import NotFoundPage from "./pages/NotFoundPage.vue";
import PlaceholderPage from "./pages/PlaceholderPage.vue";

declare module "vue-router" {
  interface RouteMeta {
    title: string;
    description?: string;
  }
}

const APP_NAME = "Chester Gang Show casting";

// The menu lists these in order. To add a page: add an entry here.
export const menuPages = [
  {
    path: "/",
    name: "running-order",
    meta: {
      title: "Running order",
      description: "The show's items in the order they're performed.",
    },
  },
  {
    path: "/cast",
    name: "cast",
    meta: { title: "Cast", description: "The Scouts and Explorers in this production." },
  },
  {
    path: "/casting-grid",
    name: "casting-grid",
    meta: { title: "Casting grid", description: "Who is in which item, across the whole show." },
  },
];

export function createAppRouter(history: RouterHistory = createWebHistory()) {
  const router = createRouter({
    history,
    routes: [
      ...menuPages.map((page) => ({ ...page, component: PlaceholderPage })),
      {
        path: "/:unknown(.*)*",
        name: "not-found",
        component: NotFoundPage,
        meta: { title: "Page not found" },
      },
    ],
  });

  router.afterEach((to) => {
    document.title = `${to.meta.title} · ${APP_NAME}`;
  });

  return router;
}
