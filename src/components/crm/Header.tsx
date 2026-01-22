import { Users } from "lucide-react";

export function Header() {
  return (
    <header className="border-b bg-card shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Users className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Customer CRM</h1>
            <p className="text-sm text-muted-foreground">
              Track customers & purchases
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
