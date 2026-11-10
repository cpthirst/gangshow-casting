<script setup lang="ts">
import { CastList, RoleList, RunningOrder } from "@app/shared";
import {
  type ChartData,
  Chart as ChartJS,
  type ChartOptions,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { computed, onMounted, ref } from "vue";
import { Line } from "vue-chartjs";
import NoRunningOrder from "@/components/common/NoRunningOrder.vue";
import PageTitle from "@/components/common/PageTitle.vue";
import { loadData, loadRequired } from "@/services/load-data.ts";
import { castPath, rolesPath, runningOrderPath } from "@/services/production.ts";
import {
  CAST_FLOW_PLACES,
  type CastFlowMark,
  type CastFlowPoint,
  castFlowOf,
  shortMark,
} from "@/utils/cast-flow.ts";
import { formatTime } from "@/utils/running-order.ts";

// Only the parts a line graph uses, so the rest of Chart.js stays out of the bundle (ADR 0039).
ChartJS.register(LinearScale, LineElement, PointElement, Tooltip);
// A canvas can't inherit CSS, so the graph's text takes the page's font from the stylesheet.
ChartJS.defaults.font.family = getComputedStyle(document.body).fontFamily;

type Flow = ReturnType<typeof castFlowOf>;
type State =
  | { status: "loading" }
  | { status: "no-running-order" }
  | { status: "no-cast" }
  | { status: "error" }
  | { status: "loaded"; flow: Flow };

const state = ref<State>({ status: "loading" });

// Worked out afresh on every visit, from the show as saved then; nothing is kept (FR14).
onMounted(async () => {
  try {
    const [order, roles, cast] = await Promise.all([
      loadData(runningOrderPath(), RunningOrder),
      loadRequired(rolesPath(), RoleList),
      // No cast list yet is no cast, not a failure.
      loadData(castPath(), CastList),
    ]);
    const members = cast?.members ?? [];
    if (!order) state.value = { status: "no-running-order" };
    else if (members.length === 0) state.value = { status: "no-cast" };
    else state.value = { status: "loaded", flow: castFlowOf(order, roles.roles, members) };
  } catch {
    state.value = { status: "error" };
  }
});

const flow = computed(() => (state.value.status === "loaded" ? state.value.flow : undefined));

type Place = (typeof CAST_FLOW_PLACES)[number];

// One graph per place, stacked nearest the stage first (FR10), all on one time axis and one
// people scale so the same height and the same moment line up down the page.
const graphs = computed(() => {
  const points = flow.value?.points ?? [];
  const marks = flow.value?.marks ?? [];
  const peak = Math.max(0, ...points.flatMap(({ counts }) => Object.values(counts)));
  return CAST_FLOW_PLACES.map((place) => ({
    place,
    data: dataFor(place, points),
    options: optionsFor({ points, marks, peak }),
  }));
});

function dataFor(
  { id, name, colour }: Place,
  points: CastFlowPoint[],
): ChartData<"line", { x: number; y: number }[]> {
  return {
    datasets: [
      {
        label: name,
        data: points.map(({ at, counts }) => ({ x: at, y: counts[id] })),
        borderColor: colour,
        backgroundColor: colour,
        // Each count holds from its point until the next.
        stepped: "before",
      },
    ],
  };
}

function optionsFor({
  points,
  marks,
  peak,
}: {
  points: CastFlowPoint[];
  marks: CastFlowMark[];
  peak: number;
}): ChartOptions<"line"> {
  const span = { type: "linear", min: points[0]?.at, max: points.at(-1)?.at } as const;
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      // Every graph has its own clock times and marks, so each reads on its own.
      x: {
        ...span,
        position: "bottom",
        grid: { display: false },
        ticks: { callback: (minutes) => formatTime(Number(minutes)) },
      },
      // Each item's and the interval's start, labelled along the top, cut short if long, with a
      // faint dashed line down the graph, behind its line (FR11).
      marks: {
        ...span,
        position: "top",
        afterBuildTicks: (scale) => {
          scale.ticks = marks.map(({ at }) => ({ value: at }));
        },
        ticks: {
          autoSkip: false,
          // Names tilt, up to upright, rather than run into each other on a narrow screen.
          maxRotation: 90,
          callback: (minutes) => shortMark(marks.find(({ at }) => at === minutes)?.label ?? ""),
        },
        grid: { color: "rgb(64 64 64 / 0.3)" },
        border: { dash: [4, 4] },
      },
      // Never below none: beginAtZero alone lets Chart.js pad under 0.
      y: {
        min: 0,
        max: peak,
        title: { display: true, text: "People" },
        ticks: { precision: 0 },
      },
    },
    // Pointing anywhere on a graph, or clicking or tapping it, shows its count then.
    interaction: { mode: "index", intersect: false },
    events: ["mousemove", "mouseout", "click", "touchstart", "touchmove"],
    plugins: {
      tooltip: {
        callbacks: {
          title: ([point]) => {
            const minutes = point?.parsed.x;
            return minutes == null ? "" : formatTime(minutes);
          },
        },
      },
    },
  };
}
</script>

<template>
  <PageTitle title="Cast flow" help="cast-flow" />
  <p v-if="state.status === 'loading'">Loading…</p>
  <NoRunningOrder v-else-if="state.status === 'no-running-order'" />
  <p v-else-if="state.status === 'no-cast'">
    There's no cast yet. Add them on the
    <RouterLink :to="{ name: 'cast' }">Cast page</RouterLink>.
  </p>
  <p v-else-if="state.status === 'error'" role="alert">Couldn't load the show.</p>
  <template v-else-if="state.status === 'loaded'">
    <section
      v-for="{ place, data, options } in graphs"
      :key="place.id"
      class="place-graph"
      :aria-labelledby="`place-${place.id}`"
      data-test="place"
    >
      <h2 :id="`place-${place.id}`">{{ place.name }}</h2>
      <p :id="`place-${place.id}-description`" class="place-description">
        {{ place.description }}
      </p>
      <div class="graph">
        <Line
          :data="data"
          :options="options"
          :aria-label="`${place.name} graph`"
          :aria-describedby="`place-${place.id}-description`"
        />
      </div>
    </section>
  </template>
</template>
