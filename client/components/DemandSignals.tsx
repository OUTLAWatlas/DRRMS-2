import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { DemandHeatmapCell, DemandTimelinePoint } from "@shared/api";
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";

const chartConfig = {
  demand: {
    label: "Demand pressure",
    color: "hsl(var(--chart-1))",
  },
  latency: {
    label: "Median wait (min)",
    color: "hsl(var(--chart-2))",
  },
} as const;

type HeatmapProps = {
  cells?: DemandHeatmapCell[];
  loading?: boolean;
  error?: boolean;
};

type TrendProps = {
  timeline?: DemandTimelinePoint[];
  loading?: boolean;
  error?: boolean;
};

export function DemandHeatmapGrid({ cells, loading, error }: HeatmapProps) {
  if (loading) {
    return <Skeleton className="h-40 w-full" />;
  }
  if (error) {
    return <p className="text-sm text-red-500">Unable to load demand heatmap.</p>;
  }
  if (!cells?.length) {
    return <p className="text-sm text-muted-foreground">No demand snapshot available yet.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cells.map((cell) => {
        const ratio = cell.inventoryAvailable > 0 ? cell.requestCount / Math.max(1, cell.inventoryAvailable) : cell.requestCount;
        const requestToStock = Math.min(100, Math.round(ratio * 100));
        const pressurePercent = Math.round(cell.demandPressure * 100);
        const theme = resolvePressureTheme(cell.demandPressure);
        return (
          <div
            key={`${cell.region}-${cell.resourceType}`}
            className="rounded-lg border p-3 text-sm transition"
            style={{ borderColor: theme.border, backgroundColor: theme.background }}
          >
            <div className="flex items-center justify-between text-xs uppercase text-muted-foreground">
              <span>{cell.region}</span>
              <span>{cell.resourceType}</span>
            </div>
            <p className="text-2xl font-semibold mt-1">{pressurePercent}%</p>
            <p className="text-xs text-muted-foreground">Demand pressure</p>
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Requests {cell.requestCount}</span>
                <span>Stock {cell.inventoryAvailable}</span>
              </div>
              <div className="h-2 rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${requestToStock}%` }}
                />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Pending {cell.pendingCount} • Median wait {cell.medianWaitMins != null ? `${cell.medianWaitMins.toFixed(1)}m` : "—"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function DemandTrendChart({ timeline, loading, error }: TrendProps) {
  if (loading) {
    return <Skeleton className="h-48 w-full" />;
  }
  if (error) {
    return <p className="text-sm text-red-500">Unable to load latency trend.</p>;
  }
  if (!timeline?.length) {
    return <p className="text-sm text-muted-foreground">No timeline data captured yet.</p>;
  }

  const chartData = timeline
    .slice()
    .sort((a, b) => a.bucketStart - b.bucketStart)
    .map((point) => ({
      bucketStart: point.bucketStart,
      label: new Date(point.bucketStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      demand: Number(point.avgDemandPressure.toFixed(2)),
      latency: point.medianWaitMins != null ? Number(point.medianWaitMins.toFixed(1)) : null,
    }));

  return (
    <ChartContainer config={chartConfig} className="min-h-[260px] w-full">
      <AreaChart data={chartData} margin={{ left: 8, right: 16, top: 16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={12} />
        <YAxis yAxisId="left" tickLine={false} axisLine={false} width={32} />
        <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} width={42} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="demand"
          yAxisId="left"
          stroke="var(--color-demand)"
          fill="var(--color-demand)"
          fillOpacity={0.2}
          strokeWidth={2}
          name="demand"
        />
        <Line
          type="monotone"
          dataKey="latency"
          yAxisId="right"
          stroke="var(--color-latency)"
          strokeWidth={2}
          dot={false}
          connectNulls
          name="latency"
        />
      </AreaChart>
    </ChartContainer>
  );
}

function resolvePressureTheme(value: number) {
  if (value >= 1.2) {
    return { background: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.6)" };
  }
  if (value >= 0.9) {
    return { background: "rgba(251,191,36,0.16)", border: "rgba(251,191,36,0.6)" };
  }
  if (value >= 0.6) {
    return { background: "rgba(250,204,21,0.14)", border: "rgba(250,204,21,0.5)" };
  }
  return { background: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.5)" };
}
