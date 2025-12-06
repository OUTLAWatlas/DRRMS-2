import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserCircle2 } from "lucide-react";
import { useAppStore, type User } from "@/state/app-store";

const ROLE_LINKS: { path: string; label: string; roles: User["role"][] }[] = [
  { path: "/user", label: "User Portal", roles: ["survivor"] },
  { path: "/rescue", label: "Rescue Portal", roles: ["rescuer"] },
  { path: "/admin", label: "Admin Portal", roles: ["admin"] },
  { path: "/resources", label: "Resource Console", roles: ["admin", "rescuer", "survivor"] },
];

const ROLE_HOME: Record<User["role"], string> = {
  survivor: "/user",
  rescuer: "/rescue",
  admin: "/admin",
};

export default function SiteHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);

  const visibleLinks = user
    ? ROLE_LINKS.filter((link) => link.roles.includes(user.role))
    : ROLE_LINKS;

  const handleSignOut = () => {
    logout();
    navigate("/");
  };

  const goToPortal = () => {
    if (!user) return;
    navigate(ROLE_HOME[user.role]);
  };

  const goToForgotPassword = () => {
    navigate("/forgot-password");
  };

  return (
    <header className="w-full bg-brand text-brand-foreground">
      <div className="container mx-auto flex items-center justify-between py-4">
        <Link to="/" className="font-extrabold tracking-[0.3em] text-xl sm:text-2xl">
          DRRMS
        </Link>
        <div className="hidden sm:flex items-center gap-6 text-sm">
          <nav className="flex items-center gap-6">
            {visibleLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={
                  "hover:opacity-80 transition-opacity " +
                  (location.pathname.startsWith(link.path) ? "underline underline-offset-4" : "")
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="secondary" className="flex items-center gap-2">
                  <UserCircle2 className="h-4 w-4" />
                  <span>{user.name?.split(" ")[0] ?? "Profile"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>
                  <p className="text-sm font-semibold leading-none">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={goToPortal}>Go to my portal</DropdownMenuItem>
                <DropdownMenuItem onSelect={goToForgotPassword}>Forgot password</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/signin" className="ml-2">
              <Button size="sm" variant="secondary">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
