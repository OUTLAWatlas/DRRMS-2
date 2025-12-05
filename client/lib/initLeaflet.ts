import L from "leaflet";

const iconRetinaUrl = new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).toString();
const iconUrl = new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString();
const shadowUrl = new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString();

if (typeof window !== "undefined") {
  // Ensure default marker icons resolve correctly under Vite bundling
  L.Icon.Default.mergeOptions({
    iconRetinaUrl,
    iconUrl,
    shadowUrl,
    shadowAnchor: [12, 41],
  });
}

export { L };
