<script setup lang="ts">
import { CastList, RoleList, RunningOrder } from "@app/shared";
import {
  type ChartData,
  Chart as ChartJS,
  type ChartOptions,
  Legend,
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
import { CAST_FLOW_PLACES, castFlowOf } from "@/utils/cast-flow.ts";
import { formatTime } from "@/utils/running-order.ts";

// Only the parts a line graph uses, so the rest of Chart.js stays out of the bundle (ADR 0039).
ChartJS.register(LinearScale, LineElement, PointElement, Legend, Tooltip);
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

const data = computed<ChartData<"line", { x: number; y: number }[]>>(() => ({
  datasets: CAST_FLOW_PLACES.map(({ id, name, colour }) => ({
    label: name,
    data: (flow.value?.points ?? []).map(({ at, counts }) => ({ x: at, y: counts[id] })),
    borderColor: colour,
    backgroundColor: colour,
    // Each count holds from its point until the next.
    stepped: "before",
  })),
}));

const options = computed<ChartOptions<"line">>(() => {
  const points = flow.value?.points ?? [];
  const marks = flow.value?.marks ?? [];
  const span = { type: "linear", min: points[0]?.at, max: points.at(-1)?.at } as const;
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ...span,
        position: "bottom",
        grid: { display: false },
        ticks: { callback: (minutes) => formatTime(Number(minutes)) },
      },
      // Each item's and the interval's start, by its label, with a faint dashed line up the
      // graph, drawn behind the place lines (FR11).
      marks: {
        ...span,
        position: "top",
        afterBuildTicks: (scale) => {
          scale.ticks = marks.map(({ at }) => ({ value: at }));
        },
        ticks: {
          autoSkip: false,
          callback: (minutes) => marks.find(({ at }) => at === minutes)?.label ?? "",
        },
        grid: { color: "rgb(64 64 64 / 0.3)" },
        border: { dash: [4, 4] },
      },
      // Never below none: beginAtZero alone lets Chart.js pad under 0.
      y: { min: 0, title: { display: true, text: "People" }, ticks: { precision: 0 } },
    },
    // Pointing anywhere on the graph, or clicking or tapping it, shows every place's count then.
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
});
</script>

<template>
  <PageTitle title="Cast flow" help="cast-flow" />
  <NoRunningOrder v-if="state.status === 'no-running-order'" />
  <p v-else-if="state.status === 'no-cast'">
    There's no cast yet. Add them on the
    <RouterLink :to="{ name: 'cast' }">Cast page</RouterLink>.
  </p>
  <p v-else-if="state.status === 'error'" role="alert">Couldn't load the show.</p>
  <div v-else-if="state.status === 'loaded'" class="graph">
    <Line
      :data="data"
      :options="options"
      aria-label="Line graph of how many of the cast are in each place through the show"
    />
  </div>
</template>
