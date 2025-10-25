type Props = { n: number };

export default function NumberBadge({ n }: Props) {
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-foreground text-background size-7 text-sm font-bold mr-3">
      {n}
    </span>
  );
}
