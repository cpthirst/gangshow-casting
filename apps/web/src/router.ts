import type { Component } from "vue";
import { createRouter, createWebHistory, type RouterHistory } from "vue-router";
import AccountsPage from "./pages/AccountsPage.vue";
import CastingItemPage from "./pages/CastingItemPage.vue";
import CastingItemsPage from "./pages/CastingItemsPage.vue";
import CastingOverviewPage from "./pages/CastingOverviewPage.vue";
import CastPage from "./pages/CastPage.vue";
import NotFoundPage from "./pages/NotFoundPage.vue";
import PlaceholderPage from "./pages/PlaceholderPage.vue";
import RunningOrderPage from "./pages/RunningOrderPage.vue";

declare module "vue-router" {
  interface RouteMeta {
    title: string;
    description?: string;
    /** The menu page to mark as current, for a page that isn't in the menu itself. */
    menuPage?: string;
  }
}

const APP_NAME = "Chester Gang Show casting";

/** Names the page in the browser tab, e.g. once a page knows which item it shows. */
export function showPageTitle(title: string) {
  document.title = `${title} · ${APP_NAME}`;
}

interface MenuPage {
  path: string;
  name: string;
  component?: Component;
  meta: { title: string; description: string };
  /** Left out of non-admins' menus. The API refuses them anyway: this only tidies the menu. */
  adminOnly?: boolean;
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
        component: CastingOverviewPage,
        meta: {
          title: "Overview",
          description: "Everyone in the cast, by section, and how much they're cast.",
        },
      },
      {
        path: "/casting/items",
        name: "casting-items",
        component: CastingItemsPage,
        meta: {
          title: "Items",
          description: "The show's items, with how far each one's casting has got.",
        },
      },
    ],
  },
  {
    path: "/accounts",
    name: "accounts",
    component: AccountsPage,
    meta: { title: "Accounts", description: "The production team's sign-in accounts." },
    adminOnly: true,
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
      {
        path: "/casting/items/:itemId",
        name: "casting-item",
        component: CastingItemPage,
        meta: { title: "Item", menuPage: "casting-items" },
      },
      // Where Sign out goes first, so the page being left can ask about unsaved changes.
      {
        path: "/signing-out",
        name: "signing-out",
        component: { render: () => null },
        meta: { title: "Signing out" },
      },
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

  router.afterEach((to) => showPageTitle(to.meta.title));

  return router;
}
