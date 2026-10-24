import type { InjectionKey } from "vue";

/** Shows a menu group (by name) in the menu: the app provides it, pages such as Welcome call it. */
export const showMenuGroupKey: InjectionKey<(group: string) => void> = Symbol("showMenuGroup");
