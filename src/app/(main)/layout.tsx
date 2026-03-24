import { BottomNav } from "@/components/layout/bottom-nav";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="flex-1" style={{ paddingBottom: "var(--nav-total-height)" }}>{children}</main>
      <BottomNav />
    </div>
  );
}
