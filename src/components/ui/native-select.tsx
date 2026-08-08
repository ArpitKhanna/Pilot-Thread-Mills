import { cn } from "@/lib/utils";

type NativeSelectProps = React.ComponentProps<"select">;

export function NativeSelect({ className, ...props }: NativeSelectProps) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 sm:w-auto sm:min-w-[140px]",
        className,
      )}
      {...props}
    />
  );
}

export const nativeSelectClass =
  "h-9 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-auto sm:min-w-[140px]";
