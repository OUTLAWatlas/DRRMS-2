import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function SiteHeader() {
  const location = useLocation();
  return (
    <header className="w-full bg-brand text-brand-foreground">
      <div className="container mx-auto flex items-center justify-between py-4">
        <Link to="/" className="font-extrabold tracking-[0.3em] text-xl sm:text-2xl">
          DRRMS
        </Link>
        <div className="hidden sm:flex items-center gap-6 text-sm">
          <nav className="flex items-center gap-6">
            <Link
              to="/user"
              className={
                "hover:opacity-80 transition-opacity " +
                (location.pathname.startsWith("/user") ? "underline underline-offset-4" : "")
              }
            >
              User Portal
            </Link>
            <Link
              to="/report"
              className={
                "hover:opacity-80 transition-opacity " +
                (location.pathname.startsWith("/report") ? "underline underline-offset-4" : "")
              }
            >
              Report
            </Link>
            <Link
              to="/resources"
              className={
                "hover:opacity-80 transition-opacity " +
                (location.pathname.startsWith("/resources") ? "underline underline-offset-4" : "")
              }
            >
              Resources
            </Link>
            <Link
              to="/rescue"
              className={
                "hover:opacity-80 transition-opacity " +
                (location.pathname.startsWith("/rescue") ? "underline underline-offset-4" : "")
              }
            >
              Rescue Portal
            </Link>
          </nav>
          <Link to="/signin" className="ml-2">
            <Button size="sm" variant="secondary">Sign In</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
