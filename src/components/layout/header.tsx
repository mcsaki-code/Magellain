"use client";

import { cn } from "@/lib/utils";

interface HeaderProps {
  title?: string;
  className?: string;
  children?: React.ReactNode;
}

export function Header({ title, className, children }: HeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-14 items-center border-b border-border bg-card/95 px-4 backdrop-blur-md safe-top",
        className
      )}
    >
      {title ? (
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      ) : null}
      {children}
    </header>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("text-xl font-bold tracking-tight", className)}>
      <span className="text-navy dark:text-white">Magell</span>
      <span className="text-ocean">AI</span>
      <span className="text-navy dark:text-white">n</span>
    </span>
  );
}
