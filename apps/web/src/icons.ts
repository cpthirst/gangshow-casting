// The app's icons, named by what they mean, so every page uses the same icon for the same
// job (ADR 0013). Font Awesome's free solid set; each is imported on its own, so only these
// are bundled. Icons are decorative: the button or link around them carries the name.
import {
  faArrowDown,
  faArrowRightArrowLeft,
  faArrowUp,
  faChevronLeft,
  faChevronRight,
  faCircle,
  faCircleDot,
  faCircleInfo,
  faGripVertical,
  faKey,
  faList,
  faPen,
  faShieldHalved,
  faSquareXmark,
  faTrashCan,
  faTriangleExclamation,
  faUserCheck,
  faUserShield,
  faUserSlash,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";

export const icons = {
  edit: faPen,
  remove: faTrashCan,
  // An account's actions on the Accounts page.
  resetPassword: faKey,
  disable: faUserSlash,
  enable: faUserCheck,
  makeAdmin: faUserShield,
  // Shields for admin, so neither looks like Disable's crossed-out person.
  removeAdmin: faShieldHalved,
  cast: faUsers,
  drag: faGripVertical,
  moveUp: faArrowUp,
  moveDown: faArrowDown,
  moveToOtherHalf: faArrowRightArrowLeft,
  allItems: faList,
  back: faChevronLeft,
  forward: faChevronRight,
  // A different shape for each clash severity, so it never relies on colour alone.
  error: faSquareXmark,
  warning: faTriangleExclamation,
  info: faCircleInfo,
  // A person's timeline on the Overview: in an item, or not. Different shapes, so it never
  // relies on colour alone.
  inItem: faCircleDot,
  notInItem: faCircle,
};
