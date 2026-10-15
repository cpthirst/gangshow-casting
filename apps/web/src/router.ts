import type { Component } from "vue";
import { createRouter, createWebHistory, type RouterHistory } from "vue-router";
import CastPage from "./pages/CastPage.vue";
import NotFoundPage from "./pages/NotFoundPage.vue";
import PlaceholderPage from "./pages/PlaceholderPage.vue";
import RunningOrderPage from "./pages/RunningOrderPage.vue";

declare module "vue-router" {
  interface RouteMeta {
    title: string;
    description?: string;
  }
}

const APP_NAME = "Chester Gang Show casting";

interface MenuPage {
  path: string;
  name: string;
  component?: Component;
  meta: { title: string; description: string };
}

/** A label in the menu with its own pages beneath it; the label isn't a page itself. */
interface MenuGroup {
  name: string;
  title: string;
  pages: MenuPage[];
}

// The menu lists these in order. To add a page: add an entry here, or to a group's pages
// (pages without a component yet show a placeholder).
export const menuPages: (MenuPage | MenuGroup)[] = [
  {
    path: "/",
    name: "running-order",
    component: RunningOrderPage,
    meta: {
      title: "Running order",
      description: "The show's items in the order they're performed.",
    },
  },
  {
    path: "/cast",
    name: "cast",
    component: CastPage,
    meta: { title: "Cast", description: "The Scouts and Explorers in this production." },
  },
  {
    name: "casting",
    title: "Casting",
    pages: [
      {
        path: "/casting/overview",
        name: "casting-overview",
        meta: { title: "Overview", description: "Who is in which item, across the whole show." },
      },
      {
        path: "/casting/items",
        name: "casting-items",
        meta: {
          title: "Items",
          description: "The show's items, with how far each one's casting has got.",
        },
      },
    ],
  },
];

export const isMenuGroup = (entry: MenuPage | MenuGroup): entry is MenuGroup => "pages" in entry;

export function createAppRouter(history: RouterHistory = createWebHistory()) {
  const router = createRouter({
    history,
    routes: [
      ...menuPages
        .flatMap((entry) => (isMenuGroup(entry) ? entry.pages : [entry]))
        .map((page) => ({
          ...page,
          component: page.component ?? PlaceholderPage,
        })),
      { path: "/casting", redirect: "/casting/overview" },
      // Bookmarks from before the Casting menu (casting-menus FR4).
      { path: "/casting-grid", redirect: "/casting/overview" },
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
