# 0039. Chart.js, with vue-chartjs, for graphs

- **Status**: Accepted
- **Date**: 2026-11-10
- **Deciders**: Maintainer

## Context

The Cast flow page (`docs/product/production/cast-flow`) draws a line graph of the show: clock times along the bottom, people up the side, one line per place. It's iCUE's first graph. The product owner asked for a well-known, popular charting library that works well with Vue, rather than a hand-drawn SVG. The graph has to work at 320px without the page scrolling sideways, in the app's colours (it has one, light, theme today; a dark one would have to reach the graph too), and meet WCAG 2.2 AA, where the PRD backs the graph up with a table of its counts (E2.S2). Everything is bundled and served from our own origin (`no-third-party.test.ts`).

## Options considered

1. **Chart.js 4 with vue-chartjs 5**: the most used JavaScript charting library, with a thin, maintained Vue 3 wrapper (`<Line>`, taking `data` and `options` as props). Tree-shakes to the parts registered, roughly 60 KB gzipped for a line chart with a legend and tooltips. A numeric x-axis labelled as clock times needs no date adapter. Responsive to its container out of the box. Colours, line dashes and point styles are set per line, so we pass our theme's tokens in. / Draws on a canvas, which a screen reader can't read: it needs an `aria-label` on the canvas and the table E2.S2 adds. No built-in dark theme.
2. **Apache ECharts 6 with vue-echarts 8**: a richer library, with an `aria` module that writes a text description of the chart, built-in light and dark themes, and an SVG renderer. / Several times larger: roughly 150 KB gzipped tree-shaken for the same chart, over 300 KB whole. Its generated description is generic and wouldn't replace the table. Its options are larger and more nested to learn and review.
3. **Hand-drawn SVG**: no dependency. / The product owner asked for a library; axes, scaling, ticks, hover and resizing would all be ours to build and test.

## Decision

We will draw graphs with Chart.js and vue-chartjs, registering only the parts a graph uses. Each line's colour is kept in code beside the place it stands for, chosen for contrast against the page, and lines differ by dash as well as colour where the PRD asks. The canvas carries an accessible name, and the counts are offered as a table too. Tests check the data and options passed to the chart, not the drawing: happy-dom has no canvas.

## Consequences

- **Easier**: a graph is a data set and a few options, in a small, well-documented library most contributors have seen. The bundle grows by the least of the options.
- **Harder**: the canvas needs its accessible name and table alternative added by us. Line colours live in code rather than CSS, so a dark theme would have to give the graph its own colours too. Two new runtime dependencies to keep up to date.
- **Revisit if**: we need a kind of chart Chart.js draws poorly (large networks, maps), the canvas can't meet an accessibility need the table doesn't cover, or vue-chartjs stops being maintained for current Vue.
