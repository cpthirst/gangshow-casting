import { type IconDefinition, icon } from "@fortawesome/fontawesome-svg-core";
import type PhotoSwipe from "photoswipe";
import "photoswipe/style.css";
import { onUnmounted } from "vue";
import { icons } from "@/utils/icons.ts";

/** An image the viewer shows, and its thumbnail on the page. */
export interface ViewerImage {
  name: string;
  src: string;
  /** Its size, from its thumbnail once that has loaded; 0 until then. */
  width: number;
  height: number;
  /** What opens it, which has focus again when the viewer closes on it. */
  thumbnail: HTMLElement;
}

/** What the viewer's Open and Download do with the image shown: the page's to handle, as a
 *  row's are. Each is called during the click, so a new tab may open then. */
export interface ViewerActions {
  open(name: string): void;
  download(name: string): void;
}

/**
 * Opens images large over the page, to swipe, zoom, open, download and close
 * (production-image-gallery FR8, FR9, FR10). PhotoSwipe (ADR 0042) brings the swiping,
 * zooming, keyboard, focus trap and the setting to reduce motion; its code loads only on the
 * first open.
 */
export function useImageViewer(label: () => string, actions: ViewerActions) {
  let viewer: PhotoSwipe | undefined;
  // Where the viewer says a problem the page has, such as a download that failed.
  let problem: HTMLElement | undefined;

  async function open(images: ViewerImage[], index: number) {
    const { default: PhotoSwipe } = await import("photoswipe");
    viewer?.destroy();
    const pswp = new PhotoSwipe({
      dataSource: images.map(({ name, src, width, height }) => ({ src, alt: name, width, height })),
      index,
      loop: true,
      // To the thumbnail of the image last shown, not the one first chosen.
      returnFocus: false,
    });
    const shown = () => images[pswp.currIndex]?.name ?? "";
    // A button named for the image shown, kept up as it changes.
    const button = (verb: string, order: number, glyph: IconDefinition, act: () => void) => ({
      name: verb.toLowerCase(),
      order,
      isButton: true,
      html: icon(glyph).html.join(""),
      onClick: act,
      onInit: (element: HTMLElement) =>
        pswp.on("change", () => element.setAttribute("aria-label", `${verb} ${shown()}`)),
    });
    pswp.on("uiRegister", () => {
      pswp.ui?.registerElement({
        name: "name",
        order: 6,
        onInit: (element) => {
          pswp.on("change", () => {
            element.textContent = shown();
          });
        },
      });
      // Beside the zoom control and Close, sharing their keyboard handling.
      pswp.ui?.registerElement(button("Open", 7, icons.openInTab, () => actions.open(shown())));
      pswp.ui?.registerElement(
        button("Download", 8, icons.download, () => actions.download(shown())),
      );
      pswp.ui?.registerElement({
        name: "problem",
        appendTo: "root",
        onInit: (element) => {
          element.setAttribute("role", "alert");
          problem = element;
          pswp.on("change", () => {
            element.textContent = "";
          });
        },
      });
    });
    pswp.on("loadComplete", ({ content, slide }) => measure(content.element, slide));
    pswp.on("destroy", () => {
      if (viewer === pswp) {
        viewer = undefined;
        problem = undefined;
      }
      images[pswp.currIndex]?.thumbnail.focus({ preventScroll: true });
    });
    pswp.init();
    pswp.element?.setAttribute("aria-label", label());
    pswp.element?.setAttribute("aria-modal", "true");
    viewer = pswp;
  }

  onUnmounted(() => viewer?.destroy());
  return {
    open,
    /** Closes it, as when the page catches up with storage. */
    close: () => viewer?.close(),
    /** Says a problem while it's open, or (undefined) clears it. */
    say(text: string | undefined) {
      if (problem) problem.textContent = text ?? "";
    },
  };
}

type Slide = NonNullable<PhotoSwipe["currSlide"]>;

// An image whose thumbnail hadn't loaded opens at the screen's size, then takes its own once
// it arrives: storage doesn't say how big an image is.
function measure(element: HTMLElement | undefined, slide: Slide) {
  if (!(element instanceof HTMLImageElement) || slide.width || !element.naturalWidth) return;
  slide.content.width = slide.width = element.naturalWidth;
  slide.content.height = slide.height = element.naturalHeight;
  slide.resize();
}
