import type PhotoSwipe from "photoswipe";
import "photoswipe/style.css";
import { onUnmounted } from "vue";

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

/**
 * Opens images large over the page, to swipe, zoom and close (production-image-gallery FR8,
 * FR9). PhotoSwipe (ADR 0042) brings the swiping, zooming, keyboard, focus trap and the
 * setting to reduce motion; its code loads only on the first open.
 */
export function useImageViewer(label: () => string) {
  let viewer: PhotoSwipe | undefined;

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
    pswp.on("uiRegister", () => {
      pswp.ui?.registerElement({
        name: "name",
        order: 6,
        onInit: (element) => {
          pswp.on("change", () => {
            element.textContent = images[pswp.currIndex]?.name ?? "";
          });
        },
      });
    });
    pswp.on("loadComplete", ({ content, slide }) => measure(content.element, slide));
    pswp.on("destroy", () => {
      if (viewer === pswp) viewer = undefined;
      images[pswp.currIndex]?.thumbnail.focus({ preventScroll: true });
    });
    pswp.init();
    pswp.element?.setAttribute("aria-label", label());
    pswp.element?.setAttribute("aria-modal", "true");
    viewer = pswp;
  }

  onUnmounted(() => viewer?.destroy());
  return { open };
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
