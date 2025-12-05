import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type StatusOption<T extends string> = {
  label: string;
  value: T;
};

type StatusPillsProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: readonly StatusOption<T>[];
};

export function StatusPills<T extends string>({ value, onChange, options }: StatusPillsProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={option.value === value ? "default" : "outline"}
          className={cn("h-8 rounded-full px-3", option.value === value && "shadow-sm")}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
