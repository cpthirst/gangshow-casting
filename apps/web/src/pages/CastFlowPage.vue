<script setup lang="ts">
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
import { Line } from "vue-chartjs";
import PageTitle from "@/components/common/PageTitle.vue";
import { CAST_FLOW_PLACES, SAMPLE_CAST_FLOW } from "@/utils/cast-flow.ts";
import { formatTime } from "@/utils/running-order.ts";

// Only the parts a line graph uses, so the rest of Chart.js stays out of the bundle (ADR 0039).
ChartJS.register(LinearScale, LineElement, PointElement, Legend, Tooltip);

const data: ChartData<"line", { x: number; y: number }[]> = {
  datasets: CAST_FLOW_PLACES.map(({ id, name, colour }) => ({
    label: name,
    data: SAMPLE_CAST_FLOW.map(({ at, counts }) => ({ x: at, y: counts[id] })),
    borderColor: colour,
    backgroundColor: colour,
  })),
};

const options: ChartOptions<"line"> = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      type: "linear",
      min: SAMPLE_CAST_FLOW[0]?.at,
      max: SAMPLE_CAST_FLOW.at(-1)?.at,
      ticks: { callback: (minutes) => formatTime(Number(minutes)) },
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
</script>

<template>
  <PageTitle title="Cast flow" help="cast-flow" />
  <div class="graph">
    <Line
      :data="data"
      :options="options"
      aria-label="Line graph of how many of the cast are in each place through the show"
    />
  </div>
</template>
