import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { Warehouse } from "@shared/api";

type Props = {
  value: number | null;
  onChange: (value: number | null) => void;
  warehouses: Warehouse[] | undefined;
  isLoading?: boolean;
  label?: string;
  includeAllOption?: boolean;
};

export function WarehouseFilterSelect({
  value,
  onChange,
  warehouses,
  isLoading,
  label = "Warehouse",
  includeAllOption = true,
}: Props) {
  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-wide">{label}</Label>
      <select
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        value={value ?? ""}
        onChange={(event) => {
          const nextValue = event.target.value;
          onChange(nextValue ? Number(nextValue) : null);
        }}
      >
        {includeAllOption && <option value="">All warehouses</option>}
        {(warehouses ?? []).map((warehouse) => (
          <option key={warehouse.id} value={warehouse.id}>
            {warehouse.name}
          </option>
        ))}
      </select>
    </div>
  );
}
