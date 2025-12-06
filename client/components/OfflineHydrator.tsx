import { useEffect } from "react";
import { useOfflineStore } from "@/state/offline-store";

const OfflineHydrator = () => {
  const hydrateFromStorage = useOfflineStore((state) => state.hydrateFromStorage);
  const status = useOfflineStore((state) => state.hydrationStatus);

  useEffect(() => {
    if (status === "idle") {
      void hydrateFromStorage();
    }
  }, [status, hydrateFromStorage]);

  return null;
};

export default OfflineHydrator;
