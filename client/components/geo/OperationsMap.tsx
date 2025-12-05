import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, LayerGroup, Marker, Tooltip } from "react-leaflet";
import type {
  GeoOverviewResponse,
  HeatmapBucket,
  CriticalAssetType,
  GeoCriticalAsset,
} from "@shared/api";
import { L } from "@/lib/initLeaflet";
import "@/lib/initLeaflet";

const DEFAULT_CENTER: [number, number] = [19.076, 72.8777];
const STATUS_COLOR: Record<string, string> = {
  pending: "#f97316",
  in_progress: "#e11d48",
  fulfilled: "#22c55e",
  cancelled: "#6b7280",
};

const ASSET_STYLE: Record<
  CriticalAssetType,
  { label: string; color: string; symbol: string }
> = {
  fire_station: { label: "Fire Station", color: "#dc2626", symbol: "🚒" },
  rescue_center: { label: "Rescue Center", color: "#ea580c", symbol: "🆘" },
  warehouse: { label: "Relief Warehouse", color: "#7c3aed", symbol: "📦" },
  police_station: { label: "Police Station", color: "#2563eb", symbol: "👮" },
  medical_center: { label: "Medical Center", color: "#0ea5e9", symbol: "🏥" },
  ndrf_base: { label: "NDRF Base", color: "#16a34a", symbol: "🚁" },
};

type OperationsMapProps = {
  overview?: GeoOverviewResponse;
  heatmap?: HeatmapBucket[];
  height?: number;
  tileUrl?: string;
};

export function OperationsMap({ overview, heatmap, height = 480, tileUrl }: OperationsMapProps) {
  if (typeof window === "undefined") return null;

  const center = useMemo(() => {
    if (overview?.requests?.length) {
      const first = overview.requests[0];
      return [first.latitude, first.longitude] as [number, number];
    }
    if (overview?.warehouses?.length) {
      const first = overview.warehouses[0];
      return [first.latitude, first.longitude] as [number, number];
    }
    return DEFAULT_CENTER;
  }, [overview]);

  const tileTemplate = tileUrl ?? import.meta.env.VITE_PUBLIC_MAP_TILES_URL ?? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const maxBucket = heatmap && heatmap.length ? Math.max(...heatmap.map((b) => b.total)) : 1;

  const assetIcons = useMemo(() => {
    const entries = Object.entries(ASSET_STYLE) as Array<[CriticalAssetType, (typeof ASSET_STYLE)[CriticalAssetType]]>;
    return entries.reduce<Record<CriticalAssetType, L.DivIcon>>((acc, [type, style]) => {
      acc[type] = L.divIcon({
        className: "asset-icon",
        html: `<span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9999px;background:${style.color};color:#fff;font-size:16px;border:2px solid rgba(255,255,255,0.9);box-shadow:0 1px 6px rgba(15,23,42,0.35);">${style.symbol}</span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      return acc;
    }, {} as Record<CriticalAssetType, L.DivIcon>);
  }, []);

  const legendItems = useMemo<LegendItem[]>(() => {
    const assetEntries: LegendItem[] = Object.entries(ASSET_STYLE).map(([type, style]) => ({
      label: style.label,
      sample: type as CriticalAssetType,
    }));
    return [
      { label: "Pending / Active Requests", sample: "request" },
      { label: "Resource Allocations", sample: "allocation" },
      { label: "Relief Warehouses", sample: "warehouse" },
      ...assetEntries,
      { label: "Need-density Clusters", sample: "heatmap" },
    ];
  }, []);

  return (
    <div className="relative rounded-xl border overflow-hidden" style={{ height }}>
      <MapContainer center={center} zoom={6} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer url={tileTemplate} attribution="&copy; OpenStreetMap contributors" />

        {heatmap && heatmap.length > 0 && (
          <LayerGroup>
            {heatmap.map((bucket) => (
              <CircleMarker
                key={bucket.id}
                center={[bucket.latitude, bucket.longitude]}
                radius={Math.max(6, (bucket.total / maxBucket) * 20)}
                pathOptions={{ color: "#fb923c", fillColor: "#fb923c", fillOpacity: 0.4, weight: 0 }}
              >
                <Popup>
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold">Cluster total: {bucket.total}</p>
                    <p>Pending: {bucket.pending}</p>
                    <p>In progress: {bucket.inProgress}</p>
                    <p>Fulfilled: {bucket.fulfilled}</p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </LayerGroup>
        )}

        {overview?.requests?.map((request) => (
          <CircleMarker
            key={`request-${request.id}`}
            center={[request.latitude, request.longitude]}
            radius={8}
            pathOptions={{
              color: STATUS_COLOR[request.status] ?? "#2563eb",
              fillColor: STATUS_COLOR[request.status] ?? "#2563eb",
              fillOpacity: 0.8,
              weight: 1,
            }}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-semibold">Request #{request.id}</p>
                <p>Status: {request.status}</p>
                <p>Priority: {request.priority}</p>
                {request.peopleCount !== null && <p>People: {request.peopleCount}</p>}
                <p>Score: {request.criticalityScore}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {overview?.warehouses?.map((warehouse) => (
          <CircleMarker
            key={`warehouse-${warehouse.id}`}
            center={[warehouse.latitude, warehouse.longitude]}
            radius={10}
            pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.6, weight: 2 }}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-semibold">{warehouse.name}</p>
                <p>Stock: {warehouse.stockLevel.toLocaleString()}</p>
                <p>Capacity: {warehouse.capacity.toLocaleString()}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {overview?.allocations?.map((allocation) => (
          <CircleMarker
            key={`allocation-${allocation.id}`}
            center={[allocation.latitude, allocation.longitude]}
            radius={6}
            pathOptions={{ color: "#0ea5e9", fillColor: "#0ea5e9", fillOpacity: 0.5, weight: 1 }}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-semibold">Allocation #{allocation.id}</p>
                <p>Request: {allocation.requestId}</p>
                <p>Quantity: {allocation.quantity}</p>
                <p>Status: {allocation.status}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {overview?.criticalAssets?.map((asset: GeoCriticalAsset) => (
          <Marker key={asset.id} position={[asset.latitude, asset.longitude]} icon={assetIcons[asset.type]}>
            <Tooltip direction="top" offset={[0, -12]} opacity={0.95} permanent={false}>
              <div className="space-y-1">
                <p className="font-semibold text-sm">{asset.name}</p>
                <p className="text-xs text-muted-foreground">
                  {asset.city}, {asset.state}
                </p>
                {asset.description && <p className="text-xs">{asset.description}</p>}
                {asset.contact && (
                  <p className="text-[11px] text-muted-foreground">Contact: {asset.contact}</p>
                )}
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>

      <div className="absolute top-3 right-3 z-[1000] bg-white/90 backdrop-blur rounded-lg shadow px-4 py-3 text-xs space-y-2">
        <p className="font-semibold uppercase tracking-wide text-[10px] text-slate-600">Index</p>
        <div className="space-y-1">
          {legendItems.map((item, idx) => {
            if (item.sample === "request") {
              return (
                <LegendRow key={`legend-${idx}`} color="#f97316" label={item.label} symbol="●" />
              );
            }
            if (item.sample === "allocation") {
              return (
                <LegendRow key={`legend-${idx}`} color="#0ea5e9" label={item.label} symbol="●" />
              );
            }
            if (item.sample === "warehouse") {
              return (
                <LegendRow key={`legend-${idx}`} color="#22c55e" label={item.label} symbol="●" />
              );
            }
            if (item.sample === "heatmap") {
              return (
                <LegendRow key={`legend-${idx}`} color="#fb923c" label={item.label} symbol="⬤" />
              );
            }

            const style = ASSET_STYLE[item.sample as CriticalAssetType];
            return (
              <LegendRow
                key={`legend-${idx}`}
                color={style.color}
                label={style.label}
                symbol={style.symbol}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

type LegendRowProps = {
  color: string;
  symbol: string;
  label: string;
};

type LegendSample = CriticalAssetType | "request" | "allocation" | "warehouse" | "heatmap";

type LegendItem = {
  label: string;
  sample: LegendSample;
};

function LegendRow({ color, symbol, label }: LegendRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full text-[11px]"
        style={{ backgroundColor: color, color: "#fff" }}
      >
        {symbol}
      </span>
      <span>{label}</span>
    </div>
  );
}
