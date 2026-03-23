import { Header } from "@/components/layout/header";

export default function ChatPage() {
  return (
    <div className="flex flex-col">
      <Header title="Sailing Coach" />
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            AI sailing coach coming in a future session
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Claude-powered with live weather + race data tools
          </p>
        </div>
      </div>
    </div>
  );
}
