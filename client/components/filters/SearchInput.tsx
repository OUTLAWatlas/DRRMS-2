import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type Props = {
  label?: string;
  placeholder?: string;
  value: string;
  onCommit: (value: string) => void;
  debounceMs?: number;
};

export function DebouncedSearchInput({
  label = "Search",
  placeholder,
  value,
  onCommit,
  debounceMs = 350,
}: Props) {
  const [draft, setDraft] = useState(value);
  const debounced = useDebouncedValue(draft, debounceMs);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (debounced === value) return;
    onCommit(debounced);
  }, [debounced, value, onCommit]);

  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-wide">{label}</Label>
      <Input
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    </div>
  );
}
