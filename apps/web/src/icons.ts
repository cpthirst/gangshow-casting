// The app's icons, named by what they mean, so every page uses the same icon for the same
// job (ADR 0013). Font Awesome's free solid set; each is imported on its own, so only these
// are bundled. Icons are decorative: the button or link around them carries the name.
import {
  faArrowDown,
  faArrowRightArrowLeft,
  faArrowUp,
  faChevronLeft,
  faChevronRight,
  faCircleInfo,
  faGripVertical,
  faPen,
  faSquareXmark,
  faTrashCan,
  faTriangleExclamation,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";

export const icons = {
  edit: faPen,
  remove: faTrashCan,
  cast: faUsers,
  drag: faGripVertical,
  moveUp: faArrowUp,
  moveDown: faArrowDown,
  moveToOtherHalf: faArrowRightArrowLeft,
  back: faChevronLeft,
  forward: faChevronRight,
  // A different shape for each clash severity, so it never relies on colour alone.
  error: faSquareXmark,
  warning: faTriangleExclamation,
  info: faCircleInfo,
};
