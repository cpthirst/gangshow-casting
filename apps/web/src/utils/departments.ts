import type { PageView } from "@app/shared";

export interface DepartmentView {
  /** Also what the Usage page records a switch to it as. */
  name: PageView;
  title: string;
  description: string;
}

export interface Department {
  title: string;
  description: string;
  /** The views its switch offers, in order; it opens on the first. None: no switch. */
  views: DepartmentView[];
}

// Production's pages, one per department, by their route name. Each view says "Coming soon"
// until its feature is built (stage-props FR11); Props is built (E4).
export const departments = {
  stage: {
    title: "Stage",
    description: "The scenery and props each item needs.",
    views: [
      { name: "scenery", title: "Scenery", description: "The scenery each item needs." },
      {
        name: "props",
        title: "Props",
        description: "The show's items, with how many props each one needs.",
      },
    ],
  },
  tech: {
    title: "Tech",
    description: "The mic plot and sound effects for each item.",
    views: [
      {
        name: "mic-plot",
        title: "Mic plot",
        description: "Which microphone is on whom, item by item.",
      },
      { name: "sfx", title: "SFX", description: "The sound effects for each item." },
    ],
  },
  wardrobe: {
    title: "Wardrobe",
    description: "The costumes each item needs.",
    views: [],
  },
} satisfies Record<string, Department>;

export type DepartmentName = keyof typeof departments;

/** The view an address names, or the department's first view for one it doesn't have. */
export const viewNamed = (department: Department, name: unknown) =>
  department.views.find((view) => view.name === name) ?? department.views[0];
