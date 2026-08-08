"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type ListStatusTab<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

type ListStatusTabsProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  tabs: ListStatusTab<T>[];
  className?: string;
};

export function ListStatusTabs<T extends string>({
  value,
  onValueChange,
  tabs,
  className,
}: ListStatusTabsProps<T>) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      className={cn("w-full sm:w-auto", className)}
    >
      <TabsList className="h-auto w-full p-0.5 sm:w-auto">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="flex-1 px-3 py-2 sm:flex-none sm:py-1.5"
          >
            {tab.label}
            {tab.count !== undefined ? ` (${tab.count})` : ""}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
