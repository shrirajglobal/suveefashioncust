import { memo, useCallback } from "react";
import { Users, LogOut, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Header = memo(function Header() {
  const { user, userRole, signOut } = useAuth();
  const navigate = useNavigate();

  const handleHomeClick = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const handleSettingsClick = useCallback(() => {
    navigate("/settings");
  }, [navigate]);

  const getRoleBadge = () => {
    if (!userRole) return null;
    const labels: Record<string, string> = {
      super_admin: "Super Admin",
      accounts: "Accounts",
      sales_team: "Sales Team",
    };
    return (
      <Badge variant="secondary" className="ml-2">
        {labels[userRole] || userRole}
      </Badge>
    );
  };

  return (
    <header className="border-b bg-card shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary cursor-pointer"
              onClick={handleHomeClick}
            >
              <Users className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 
                className="text-xl font-bold tracking-tight cursor-pointer"
                onClick={handleHomeClick}
              >
                Suvee Fashion CRM
                {getRoleBadge()}
              </h1>
              <p className="text-sm text-muted-foreground">
                Track customers & purchases
              </p>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={handleSettingsClick}>
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Settings</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
});
