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
  faCircleQuestion,
  faFile,
  faFileAudio,
  faFileExcel,
  faFileWord,
  faGripVertical,
  faHammer,
  faKey,
  faList,
  faMicrophone,
  faPen,
  faPersonWalkingLuggage,
  faShirt,
  faSquareXmark,
  faTrashCan,
  faTriangleExclamation,
  faUserCheck,
  faUserSlash,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";

export const icons = {
  edit: faPen,
  // Open an item's page for each department from the Production overview.
  scenery: faHammer,
  props: faPersonWalkingLuggage,
  sfx: faFileAudio,
  micPlot: faMicrophone,
  wardrobe: faShirt,
  remove: faTrashCan,
  // A file on an item's Scenery page, whatever its type, until types get their own icons.
  file: faFile,
  // An account's actions on the Accounts page.
  resetPassword: faKey,
  disable: faUserSlash,
  enable: faUserCheck,
  cast: faUsers,
  // Admins export the casting grid as an Excel file.
  exportFile: faFileExcel,
  // Every role exports Word documents from the Overview.
  exportWord: faFileWord,
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
  // Opens a page's help (in-app-help).
  help: faCircleQuestion,
  // A person's timeline on the Overview: in an item, or not. Different shapes, so it never
  // relies on colour alone.
  inItem: faCircleDot,
  notInItem: faCircle,
};
