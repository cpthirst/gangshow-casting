# 0042. An image gallery on the Production file pages

- **Status**: Accepted (option 1, 2026-11-26; the grid shows the images themselves, loaded lazily, with no stored previews)
- **Date**: 2026-11-24
- **Deciders**: Nick Hirst

## Context

The Scenery, SFX and Wardrobe item pages list each item's files as one column of rows, and choosing an image opens it in a new tab (ADR 0030). Thumbnails were dropped on 2026-10-29 (production-scenery E2.S3). The maintainer is considering them again. Images would sit in a section of their own at the top of the page, in a thumbnail grid that adapts to the screen width, with every other file under "Other Files" below. Props would join once it keeps files: today `fileDepartments` is Scenery, SFX and Wardrobe only.

The maintainer's criteria, in order:
1. A Vue library with a large community and many downloads, that is still maintained.
2. Simplicity of implementation.

A gallery is really two parts. The **grid** lays out the thumbnails, which is a few lines of CSS. The **viewer** (a lightbox) opens one image large, with next and previous, swipe and pinch-to-zoom. Libraries compete on the viewer, and most leave the grid to you. Whichever we choose, the repo's constraints apply:

- **Private files.** Every image is reached through a presigned S3 link that lasts 5 minutes, fetched one file at a time today. The grid needs links for all of an item's images in one request.
- **Content Security Policy.** The policy has `img-src 'self'`, so it must also name the files bucket, as `connect-src` already does. Its `style-src 'self'` rules out any library that adds `<style>` tags at run time; CSS imported through Vite is fine.
- **Image size.** Files can be up to 100 MB, and volunteers often use phones backstage. No library makes thumbnails: either the grid loads the full images, lazily, or thumbnails are made and stored when a file is uploaded. That second choice changes ADR 0030 and needs a story of its own.
- **Images the browser can show.** Only the types that already open in a tab (JPG, PNG, GIF, WebP) belong in the grid. SVG, HEIC, TIFF and the rest stay under Other Files.

### The candidates (npm and GitHub, 2026-11-24)

| Library | Weekly downloads | Latest release | GitHub | Gzipped | Licence | Vue binding |
|---|---|---|---|---|---|---|
| **PhotoSwipe 5** | 845k | 5.4.4, May 2024 (repo active Dec 2025) | 25.3k ★ | 17 KB, lazy-loaded | MIT | None needed: works on plain DOM |
| **Viewer.js + v-viewer** | 166k + 48k | 1.15.2, Oct 2026 / 5.0.0, Oct 2026 | 8.2k ★ / 2.6k ★ | 15 KB + 3 KB | MIT | v-viewer: directive, component, API |
| lightGallery | 132k | 3.0.0, Oct 2026 | 7.1k ★ | – | GPL-3.0 or paid | Official Vue component |
| Fancybox (`@fancyapps/ui`) | 123k | 6.1.15, Sep 2026 | – | – | Paid licence | None |
| vue-easy-lightbox | 86k | 1.19.0, Mar 2024 (repo idle since Apr 2024) | 465 ★ | 8 KB | MIT | Native Vue 3 |
| GLightbox | 82k | 3.3.1, Jan 2025 | 2.5k ★ | 15 KB | MIT | None |

lightGallery and Fancybox are out because of their licences. vue-easy-lightbox is out because it is barely maintained, and its default build adds its CSS at run time, which our CSP refuses. GLightbox brings no Vue binding and is smaller than PhotoSwipe. That leaves the options below.

## Options considered

All of them share the same grid, plain CSS on the existing card styles:

```vue
<ul class="thumb-grid" role="list" :aria-label="`${named.name} images`">
  <li v-for="image in images" :key="image.name">
    <a :href="image.url" @click.prevent="open(image)">
      <img :src="image.url" :alt="image.name" loading="lazy" decoding="async" />
    </a>
  </li>
</ul>
```

```css
.thumb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr)); gap: 0.5rem; }
.thumb-grid img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: var(--radius); }
```

1. **CSS grid, and PhotoSwipe as the viewer.**
   - Pros:
     - By far the largest community: 5× the downloads of its nearest MIT rival, and 25k stars.
     - Best in class on phones: swipe, pinch-to-zoom, and swipe down to close, with keyboard support and labelled buttons.
     - No Vue wrapper that could go stale, and its core loads only when someone first opens an image.
   - Cons:
     - No release since May 2024 (it is stable, and its repository is still looked after).
     - It needs each image's width and height before opening it, and S3's listing doesn't give them. We read them from the loaded thumbnail. That works while thumbnails are the full images, but stored thumbnails would mean keeping the full size too.

   ```ts
   import PhotoSwipeLightbox from "photoswipe/lightbox";
   import "photoswipe/style.css";

   const grid = useTemplateRef("grid");
   let lightbox: PhotoSwipeLightbox | undefined;
   onMounted(() => {
     lightbox = new PhotoSwipeLightbox({
       gallery: grid.value!,  // as written; our rules want a guard instead of `!`
       children: "a",
       pswpModule: () => import("photoswipe"),
     });
     // S3 doesn't give dimensions: take them from the thumbnail once it has loaded.
     lightbox.addFilter("domItemData", (data, el, link) => {
       const img = link.querySelector("img");
       return { ...data, src: link.href, width: img?.naturalWidth, height: img?.naturalHeight };
     });
     lightbox.init();
   });
   onUnmounted(() => lightbox?.destroy());
   ```

2. **CSS grid, and Viewer.js through v-viewer.**
   - Pros:
     - Actively released: both packages had a release in Oct 2026, and Viewer.js has one open issue.
     - The simplest to wire up. One directive on the grid turns its images into a gallery, and it measures each image itself, so there's no dimension problem.
     - Pinch-to-zoom and keyboard support.
   - Cons:
     - A quarter of PhotoSwipe's downloads.
     - The Vue binding is a separate project, kept by one person.
     - Its default toolbar (rotate, flip, play) looks like a desktop app and needs trimming.
     - Not as smooth on phones as PhotoSwipe.

   ```vue
   <script setup lang="ts">
   import { directive as vViewer } from "v-viewer";
   import "viewerjs/dist/viewer.css";
   const options = { toolbar: { prev: true, next: true, zoomIn: true, zoomOut: true }, title: true };
   </script>

   <template>
     <ul v-viewer="options" class="thumb-grid" role="list"> <!-- the grid above, with plain <img> --> </ul>
   </template>
   ```

3. **CSS grid, with no viewer library.** Choosing a thumbnail opens the image in a new tab, as it does today.
   - Pros:
     - No dependency at all.
     - The browser's own viewer already zooms and pinches.
     - The smallest change: the grid is the only new part.
   - Cons:
     - No swiping from one image to the next.
     - Each image opens a tab the volunteer must close.

4. **Hand-made viewer in a native `<dialog>`.** `showModal()` gives focus trapping, Escape to close and a backdrop at no cost. Next and previous are two buttons and an index.
   - Pros:
     - No dependency, and about 40 lines.
   - Cons:
     - Swipe, pinch-to-zoom, preloading and animation would all be ours to build and test, and are where the libraries earn their size.
     - It fails the first criterion. It only beats option 3 by keeping you on the page.

## Decision

We choose **option 1**. We build the grid in plain CSS, as a shared style, and use **PhotoSwipe 5** as the viewer. It loads on the first open, and the grid ships without it if needed. PhotoSwipe best meets the first criterion. It does the job our users most need, browsing photos on a phone, better than the others. Using no Vue wrapper also means no second project that could stop being maintained.

**Option 2 is the close runner-up.** If the maintainer weighs recent releases and simpler wiring over the size of the community, v-viewer is the better choice, and the grid stays the same. **Option 3 is the fallback** if the viewer is cut from the first story. Whichever viewer we choose, a story owns these needs:

- the list route returns signed links for an item's browser-viewable images in one request;
- `img-src` names the files bucket;
- the grid decides which files are images using the rule `opensInBrowser` already applies.

Whether the grid loads full images or stored thumbnails is a separate decision. It amends ADR 0030 when a story needs it.

## Consequences

- **Easier**:
  - Scenery and Wardrobe images can be recognised at a glance and swiped through on a phone, without opening a tab per file.
  - The grid is one shared style that every file department reads.
- **Harder**:
  - A new runtime dependency to keep up to date.
  - A tiny filter to supply image dimensions.
  - A CSP change.
  - Until thumbnails are stored, every grid loads full-size images (lazily), which is heavy over mobile data for large photos.
  - Images are more prominent. The upload rule against photos of cast members (ADR 0010) matters more.
  - Links expire after 5 minutes. A viewer opened later than that relies on the browser's cache of the thumbnail, or fetches a fresh link.
- **Revisit if**:
  - PhotoSwipe stops working with current browsers or Vite.
  - Stored thumbnails are added and keeping full dimensions for PhotoSwipe proves awkward (switch to v-viewer).
  - Volunteers prefer the tab they already know (fall back to option 3).
