import type { Component } from "vue";
import { createRouter, createWebHistory, type RouterHistory } from "vue-router";
import AccountsPage from "@/pages/AccountsPage.vue";
import CastingItemPage from "@/pages/CastingItemPage.vue";
import CastingItemsPage from "@/pages/CastingItemsPage.vue";
import CastingOverviewPage from "@/pages/CastingOverviewPage.vue";
import CastPage from "@/pages/CastPage.vue";
import DepartmentPage from "@/pages/DepartmentPage.vue";
import HelpPage from "@/pages/HelpPage.vue";
import NotFoundPage from "@/pages/NotFoundPage.vue";
import PropsItemPage from "@/pages/PropsItemPage.vue";
import RunningOrderPage from "@/pages/RunningOrderPage.vue";
import UsagePage from "@/pages/UsagePage.vue";
import WelcomePage from "@/pages/WelcomePage.vue";
import { departments } from "@/utils/departments.ts";

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
  component: Component;
  /** What the route gives its component, such as which department's page it is. */
  props?: Record<string, unknown>;
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

// The menu lists these in order. To add a page: add an entry here, or to a group's pages.
// Each name is also what the Usage page records it as (MenuPageName in @app/shared), so a new or renamed page goes there too.
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
      ...(["stage", "tech", "costume"] as const).map((name) => ({
        path: `/production/${name}`,
        name,
        component: DepartmentPage,
        props: { department: name },
        meta: { title: departments[name].title, description: departments[name].description },
      })),
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
      ...menuPages.flatMap((entry) => (isMenuGroup(entry) ? entry.pages : [entry])),
      {
        path: "/casting/items/:itemId",
        name: "casting-item",
        component: CastingItemPage,
        meta: { title: "Item", menuPage: "casting-items" },
      },
      {
        path: "/production/stage/props/:itemId",
        name: "props-item",
        component: PropsItemPage,
        meta: { title: "Item props", menuPage: "stage" },
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
      // Bookmarks from before Production's pages became Stage's and Tech's views (stage-props FR12).
      { path: "/production/scenery", redirect: { name: "stage" } },
      { path: "/production/props", redirect: { name: "stage", query: { view: "props" } } },
      { path: "/production/mic-plot", redirect: { name: "tech" } },
      { path: "/production/sfx", redirect: { name: "tech", query: { view: "sfx" } } },
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
