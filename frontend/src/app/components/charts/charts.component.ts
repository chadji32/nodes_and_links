import { Component, inject, OnInit, PLATFORM_ID } from "@angular/core";
import { CommonModule, isPlatformBrowser } from "@angular/common";
import { ActivatedRoute } from "@angular/router";
import { NgxEchartsModule } from "ngx-echarts";
import type { EChartsOption } from "echarts";

import {
  Activity,
  ApiActivitiesResponse,
  ApiAdjacencyResponse,
  LinkResponse,
  CombinedLink,
} from "../models/data.models";

// Resolver payload shape
type ResolvedData = {
  activities: ApiActivitiesResponse;
  adjacency: ApiAdjacencyResponse;
  combined: LinkResponse;
};

@Component({
  selector: "app-charts",
  standalone: true,
  imports: [CommonModule, NgxEchartsModule],
  templateUrl: "./charts.component.html",
  styleUrl: "./charts.component.css",
})
export class ChartsComponent implements OnInit {
  // SSR guard: only compute charts in browser
  private platformId = inject(PLATFORM_ID);
  isBrowser = isPlatformBrowser(this.platformId);

  data!: ResolvedData;

  // ECharts option objects
  activityXTimeOptions: EChartsOption = {};
  adjacencyHeatmapOptions: EChartsOption = {};
  combinedOverlayOptions: EChartsOption = {};

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Read data from the route resolver
    this.data = this.route.snapshot.data["data"] as ResolvedData;

    // Activities sorted ascending by nodeId (numeric if possible)
    const activities = (this.data.activities?.data ?? [])
      .filter((a) => a.startDate && a.endDate)
      .sort((a, b) => {
        const an = Number(a.nodeId),
          bn = Number(b.nodeId);
        if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
        return (a.nodeId ?? "").localeCompare(b.nodeId ?? "");
      });

    const matrix = this.data.adjacency?.matrix ?? [];
    const ids = this.buildIdsFromActivitiesOrMatrix(activities, matrix);

    if (this.isBrowser) {
      // Build chart configs only on client
      this.activityXTimeOptions = this.buildActivityXTime(activities);
      this.adjacencyHeatmapOptions = this.buildAdjacencyHeatmap(ids, matrix);
      this.combinedOverlayOptions = this.buildCombinedCircularGraphFromLinks(
        this.data.combined?.links
      );
    } else {
      // keep empty objects during SSR
      this.activityXTimeOptions = {};
      this.adjacencyHeatmapOptions = {};
      this.combinedOverlayOptions = {};
    }
  }

  // ---------- helpers ----------
  private toDate(s: string): Date {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  }
  private toTs(s: string): number {
    return this.toDate(s).getTime();
  }

  private buildIdsFromActivitiesOrMatrix(
    acts: Activity[],
    matrix: number[][]
  ): string[] {
    if (acts?.length) return acts.map((a) => a.nodeId || "");
    const n = Array.isArray(matrix) ? matrix.length : 0;
    return Array.from({ length: n }, (_, i) => String(i + 1));
  }

  // ====== Chart 1: Activity Properties (X = time, Y = node IDs) ======
  private buildActivityXTime(acts: Activity[]): EChartsOption {
    if (!acts?.length) return {};

    const cats = acts.map((a) => a.nodeId || "");

    // Precompute yIndex/start/end for custom series
    const items = acts.map((a, i) => ({
      yIndex: i,
      start: this.toTs(a.startDate),
      end: this.toTs(a.endDate),
    }));

    const minX = Math.min(...items.map((x) => x.start));
    const maxX = Math.max(...items.map((x) => x.end));

    // Pad timeline a bit to the left
    const axisMin = (() => {
      const d = new Date(minX);
      d.setMonth(d.getMonth() - 1); // 1 month earlier
      return d.getTime();
    })();

    return {
      title: {
        text: "Activity Timeline (X = Date, Y = Activity)",
        left: "center",
        top: 3,
      },
      animationDurationUpdate: 200,
      tooltip: { trigger: "item" },
      grid: { left: 70, right: 17, top: 56, bottom: 36 }, // tighter margins
      xAxis: {
        type: "time",
        min: axisMin,
        max: maxX,
        axisLabel: {
          // compact date labels
          formatter: (val: number) => new Date(val).getFullYear().toString(),
        },
        axisTick: { length: 3 },
        z: 10,
      },
      yAxis: {
        type: "category",
        data: cats,
        inverse: false,
        boundaryGap: true,
        axisLabel: {
          interval: 0,
          hideOverlap: true,
          fontSize: 10,
          margin: 2,
        },
        axisTick: { show: false },
        splitLine: { show: false },
        z: 10,
      },

      // Scroll/zoom
      dataZoom: [
        { type: "inside", yAxisIndex: 0, filterMode: "none" },
        {
          type: "slider",
          yAxisIndex: 0,
          right: 2,
          width: 12,
          start: 0,
          end: 100,
          brushSelect: false,
        },
      ],

      series: [
        {
          type: "custom",
          name: "Activity",
          encode: { y: 0, x: [1, 2] }, // [yIndex, start, end]
          data: items.map((it) => [it.yIndex, it.start, it.end]),
          clip: true,
          z: 1,
          tooltip: {
            formatter: (p: any) => {
              const [yIndex, start, end] = p.data as [number, number, number];
              const name = cats[yIndex] ?? String(yIndex);
              const s = new Date(start).toISOString().slice(0, 10);
              const e = new Date(end).toISOString().slice(0, 10);
              const days = Math.max(1, Math.round((end - start) / 86400000));
              return `<b>Activity: ${name}</b><br>From: ${s} - To: ${e}<br>Duration: ${days} days`;
            },
          },
          // Draw thin rectangles for each activity span; enforce min width for same-day spans
          renderItem: (params: any, api: any) => {
            const yIndex = api.value(0);
            const xStart = api.value(1);
            const xEnd = api.value(2);

            const p1 = api.coord([xStart, yIndex]);
            const p2 = api.coord([xEnd, yIndex]);

            const h = 3;
            const left = Math.min(p1[0], p2[0]);
            const right = Math.max(p1[0], p2[0]);

            const pxWidth = right - left;
            const minPx = 3; // guarantee visibility for zero-length ranges
            const width = Math.max(minPx, pxWidth);
            const x = pxWidth < minPx ? left - (minPx - pxWidth) / 2 : left;

            return {
              type: "rect",
              shape: {
                x,
                y: p1[1] - h / 2,
                width,
                height: h,
              },
              style: api.style(),
            };
          },
        },
      ],
    };
  }

  // ====== Chart 2: Adjacency Matrix Heatmap (optimized) ======
  private buildAdjacencyHeatmap(
    ids: string[],
    matrix: number[][]
  ): EChartsOption {
    if (!matrix?.length) return {};

    const n = matrix.length;

    const data: [number, number, number][] = [];
    // Build sparse triplets only for 1s: [x(to), y(from), value]
    for (let r = 0; r < n; r++) {
      const row = matrix[r] ?? [];
      for (let c = 0, m = row.length; c < m; c++) {
        if (row[c] === 1) data.push([c, r, 1]); // [x(to), y(from), value]
      }
    }

    return {
      animation: false,
      title: {
        text: 'Dependency Matrix (Adjacency: from → to)',
        left: 'center',
        top: 3,
      },
      grid: { left: 90, right: 90, top: 56, bottom: 90 },

      tooltip: {
        trigger: "item",
        confine: true,
        formatter: (p: any): string => {
          const from = ids[p.value[1]] ?? p.value[1];
          const to = ids[p.value[0]] ?? p.value[0];
          return `Link from Activity <b>${from}</b> to <b>${to}</b>`;
        },
      },

      xAxis: {
        type: "category",
        data: ids,
        axisLabel: { rotate: 90, fontSize: 10, interval: 0, hideOverlap: true },
        axisTick: { show: false },
        z: 10,
      },
      yAxis: {
        type: "category",
        data: ids,
        axisLabel: { fontSize: 10, interval: 0, hideOverlap: true },
        axisTick: { show: false },
        z: 10,
      },

      dataZoom: [
        { type: "inside", xAxisIndex: 0, filterMode: "none" },
        { type: "inside", yAxisIndex: 0, filterMode: "none" },
      ],

      // Keep a simple legend: only "1" is drawn; zeros are implicit background
      visualMap: {
        type: "piecewise",
        min: 0,
        max: 1,
        right: 16,
        top: "middle",
        pieces: [
          { value: 1, label: "1", color: "#1d4ed8" },
        ],
        itemWidth: 14,
        itemHeight: 14,
        textStyle: { fontSize: 12 },
      },

      series: [
        {
          type: "heatmap",
          data,
          // ✅ Let ECharts batch-render large data smoothly
          progressive: 2000,
          progressiveThreshold: 3000,
          emphasis: {
            itemStyle: { shadowBlur: 6, shadowColor: "rgba(0,0,0,.25)" },
          },
        },
      ],

      // Optional: light background to visually imply "0" cells
      backgroundColor: "#ffffff",
    };
  }

  // ====== Chart 3: Combined — circular with interactive legend ======
  private buildCombinedCircularGraphFromLinks(
    links: CombinedLink[]
  ): EChartsOption {
    if (!links?.length) return {};

    const DAY_MS = 86_400_000;
    const toTs = (s: string) => {
      const [y, m, d] = s.split("-").map(Number);
      return new Date(y, (m || 1) - 1, d || 1).getTime();
    };

    // Aggregate node time ranges from link endpoints
    const nodeTimes = new Map<string, { start: number; end: number }>();
    const addNode = (a: Activity) => {
      const s = toTs(a.startDate),
        e = toTs(a.endDate);
      const cur = nodeTimes.get(a.nodeId);
      if (!cur) nodeTimes.set(a.nodeId, { start: s, end: e });
      else
        nodeTimes.set(a.nodeId, {
          start: Math.min(cur.start, s),
          end: Math.max(cur.end, e),
        });
    };
    links.forEach((l) => {
      addNode(l.from);
      addNode(l.to);
    });

    // Degree metrics for node sizing
    const inDeg = new Map<string, number>(),
      outDeg = new Map<string, number>();
    for (const id of nodeTimes.keys()) {
      inDeg.set(id, 0);
      outDeg.set(id, 0);
    }
    links.forEach((l) => {
      outDeg.set(l.from.nodeId, (outDeg.get(l.from.nodeId) || 0) + 1);
      inDeg.set(l.to.nodeId, (inDeg.get(l.to.nodeId) || 0) + 1);
    });

    // Compute gapDays per link (fallback if not present)
    const linksWithGap = links.map((l) => {
      const ft = nodeTimes.get(l.from.nodeId)!;
      const tt = nodeTimes.get(l.to.nodeId)!;
      const earliestFrom = Math.min(ft.start, ft.end);
      const latestTo = Math.max(tt.start, tt.end);
      const gapDays =
        l.gapDays ?? Math.round((latestTo - earliestFrom) / DAY_MS);
      return { ...l, gapDays };
    });

    // Categories
    type Cat = "Backward" | "Forward";
    const catOrder: Cat[] = ["Backward", "Forward"];
    const catColors: Record<Cat, string> = {
      Backward: "#dc2626", // red
      Forward: "#6b7280", // slate gray
    };

    // Mark nodes participating in any backward/overlap edge
    const nodeCat = new Map<string, Cat>();
    for (const id of nodeTimes.keys()) nodeCat.set(id, "Forward");
    for (const l of linksWithGap) {
      if (l.gapDays! < 0) {
        nodeCat.set(l.from.nodeId, "Backward");
        nodeCat.set(l.to.nodeId, "Backward");
      }
    }

    // Arrange nodes: by category, then by start time
    const ids = Array.from(nodeTimes.keys()).sort((a, b) => {
      const ca = catOrder.indexOf(nodeCat.get(a)!);
      const cb = catOrder.indexOf(nodeCat.get(b)!);
      if (ca !== cb) return ca - cb;
      return nodeTimes.get(a)!.start - nodeTimes.get(b)!.start;
    });

    const categories = catOrder
      .filter((cn) => ids.some((id) => nodeCat.get(id) === cn))
      .map((cn) => ({ name: cn, itemStyle: { color: catColors[cn] } }));

    // Build node list
    const nodes = ids.map((id) => {
      const t = nodeTimes.get(id)!;
      const deg = inDeg.get(id)! + outDeg.get(id)!;
      return {
        id,
        name: id,
        value: [t.start, t.end],
        category: categories.findIndex((c) => c.name === nodeCat.get(id)),
        symbolSize: Math.max(8, Math.min(26, 8 + Math.log2(1 + deg) * 5)),
        itemStyle: { borderColor: "#1f2937", borderWidth: 0.6 },
      };
    });

    // Single edge set; color follows source node category
    const edgesAll = linksWithGap.map((l) => ({
      source: l.from.nodeId,
      target: l.to.nodeId,
      value: l.gapDays,
      lineStyle: { curveness: 0.25 },
    }));

    const fmt = (ts: number) => new Date(ts).toISOString().slice(0, 10);

    return {
      title: {
        text: 'Circular Dependency Network (Forward/Backward Links)',
        left: 'center',
        top: 3,
      },
      tooltip: {
        trigger: "item",
        confine: true,
        formatter: (p: any) => {
          if (p.dataType === "node") {
            const [start, end] = p.data.value as number[];
            const days = Math.max(1, Math.round((end - start) / DAY_MS));
            return `<b>${p.data.id}</b><br>${fmt(start)} → ${fmt(
              end
            )} (${days}d)<br>Group: ${categories[p.data.category]?.name ?? ""}`;
          }
          if (p.dataType === "edge") {
            const d = p.data.value as number;
            return `<b>${p.data.source}</b> → <b>${p.data.target}</b><br>${
              d < 0 ? "Backward" : "Forward"
            } ${Math.abs(d)}d`;
          }
          return "";
        },
      },

      legend: {
        top: 56,
        type: "scroll",
        data: categories.map((c) => c.name),
      },

      series: [
        {
          name: "Circular (Overlap vs Gaps)",
          type: "graph",
          layout: "circular",
          circular: { rotateLabel: true },
          data: nodes,
          links: edgesAll,
          categories,

          roam: true,
          edgeSymbol: ["none", "none"],
          blendMode: "lighter",
          lineStyle: {
            color: "source",
            width: 1,
            opacity: 0.25,
            curveness: 0.25,
          },
          emphasis: {
            focus: "adjacency",
            lineStyle: { width: 2, opacity: 0.9 },
          },
          label: { show: false },
        },
      ],
    };
  }
}
