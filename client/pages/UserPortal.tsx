import { Button } from "@/components/ui/button";
import { useAppStore } from "@/state/app-store";
import { Link, useNavigate } from "react-router-dom";

export default function UserPortal() {
  const { user, hydrated } = useAppStore();
  const navigate = useNavigate();
  const isSurvivor = hydrated && user?.role === "survivor";

  if (!hydrated) {
    return (
      <div className="py-24 text-center text-muted-foreground">
        Restoring your session…
      </div>
    );
  }
  return (
    <div className="bg-background">
      <div className="relative h-[60vh] min-h-[380px]">
        <img
          src="https://images.pexels.com/photos/3662770/pexels-photo-3662770.jpeg?auto=compress&cs=tinysrgb&w=1600"
          alt="Family"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative z-10 flex h-full items-center justify-center">
          {isSurvivor ? (
            <div className="flex flex-wrap gap-6 justify-center">
              <Link to="/request" className="rounded-full bg-white px-6 py-3 font-semibold shadow-lg">
                REQUEST HELP
              </Link>
              <button
                onClick={() => navigate("/request", { state: { fromReport: true } })}
                className="rounded-full bg-white px-6 py-3 font-semibold shadow-lg"
              >
                REPORT DISASTER
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 bg-white/90 px-8 py-6 rounded-2xl shadow-lg text-center">
              <p className="text-base font-semibold text-black">
                {user ? "Switch to a survivor account to request help." : "Sign in to access survivor tools."}
              </p>
              <div className="flex gap-3">
                <Button asChild>
                  <Link to="/signin">Sign in</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/">Go home</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="py-12 text-center">
        {isSurvivor ? (
          <p className="text-muted-foreground">Use the buttons above to request assistance or report an incident.</p>
        ) : (
          <p className="text-muted-foreground">
            Survivor tools unlock after signing in. Need admin access? Visit the rescuer portal instead.
          </p>
        )}
      </section>
    </div>
  );
}
