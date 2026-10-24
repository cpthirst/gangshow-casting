import type { Component } from "vue";
import { createRouter, createWebHistory, type RouterHistory } from "vue-router";
import AccountsPage from "@/pages/AccountsPage.vue";
import CastingItemPage from "@/pages/CastingItemPage.vue";
import CastingItemsPage from "@/pages/CastingItemsPage.vue";
import CastingOverviewPage from "@/pages/CastingOverviewPage.vue";
import CastPage from "@/pages/CastPage.vue";
import HelpPage from "@/pages/HelpPage.vue";
import NotFoundPage from "@/pages/NotFoundPage.vue";
import PlaceholderPage from "@/pages/PlaceholderPage.vue";
import RunningOrderPage from "@/pages/RunningOrderPage.vue";
import UsagePage from "@/pages/UsagePage.vue";
import WelcomePage from "@/pages/WelcomePage.vue";

declare module "vue-router" {
  interface RouteMeta {
    title: string;
    description?: string;
    /** The menu page to mark as current, for a page that isn't in the menu itself. */
    menuPage?: string;
  }
}

const APP_NAME = "iCUE";

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
// (pages without a component yet show a placeholder). Each name is also what the Usage page
// records it as (MenuPageName in @app/shared), so a new or renamed page goes there too.
export const menuPages: (MenuPage | MenuGroup)[] = [
  // Where signing in lands, and the app's own address (in-app-help FR1).
  {
    path: "/",
    name: "welcome",
    component: WelcomePage,
    meta: {
      title: "Welcome",
      description: "Where iCUE starts, and what is in each area of the menu.",
    },
  },
  {
    name: "show",
    title: "Show",
    pages: [
      {
        path: "/running-order",
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
    ],
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
    name: "production",
    title: "Production",
    pages: [
      {
        path: "/production/mic-plot",
        name: "mic-plot",
        meta: { title: "Mic plot", description: "Which microphone is on whom, item by item." },
      },
      {
        path: "/production/props",
        name: "props",
        meta: { title: "Props", description: "The props each item needs." },
      },
      {
        path: "/production/scenery",
        name: "scenery",
        meta: { title: "Scenery", description: "The scenery each item needs." },
      },
      {
        path: "/production/sfx",
        name: "sfx",
        meta: { title: "SFX", description: "The sound effects for each item." },
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
  {
    path: "/usage",
    name: "usage",
    component: UsagePage,
    meta: { title: "Usage", description: "Who on the team uses the app, and how often." },
    adminOnly: true,
  },
  {
    path: "/help",
    name: "help",
    component: HelpPage,
    meta: { title: "Help", description: "What each page is for, and what its buttons do." },
  },
];

/** Whether the named page is only for admins, such as Accounts. */
export const isAdminOnlyPage = (name: unknown) =>
  menuPages.some((entry) =>
    (isMenuGroup(entry) ? entry.pages : [entry]).some(
      (page) => page.name === name && page.adminOnly === true,
    ),
  );

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
