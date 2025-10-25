import { Link } from "react-router-dom";
import { useState } from "react";

export default function Index() {
  const [hovered, setHovered] = useState<"user" | "rescue" | null>(null);

  const cols = hovered === "user" ? "7fr 3fr" : hovered === "rescue" ? "3fr 7fr" : "1fr 1fr";

  return (
    <div className="bg-background">
      <section className="relative">
        <div className="container mx-auto py-10 sm:py-14">
          <h1 className="text-center text-4xl sm:text-5xl font-extrabold tracking-wider">DRRMS</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">Sign in from the navbar to access your dashboard.</p>
        </div>
        <div
          className="grid transition-[grid-template-columns] duration-500 md:min-h-[60vh]"
          style={{ gridTemplateColumns: cols }}
        >
          <HeroPanel
            image="https://images.pexels.com/photos/3662770/pexels-photo-3662770.jpeg?auto=compress&cs=tinysrgb&w=1600"
            label="USER PORTAL"
            to="/user"
            onEnter={() => setHovered("user")}
            onLeave={() => setHovered(null)}
            active={hovered === "user"}
          />
          <HeroPanel
            image="https://images.pexels.com/photos/942320/pexels-photo-942320.jpeg?auto=compress&cs=tinysrgb&w=1600"
            label="RESCUE PORTAL"
            to="/rescue"
            onEnter={() => setHovered("rescue")}
            onLeave={() => setHovered(null)}
            active={hovered === "rescue"}
          />
        </div>
      </section>
    </div>
  );
}

function HeroPanel({ image, label, to, onEnter, onLeave, active }: { image: string; label: string; to: string; onEnter: () => void; onLeave: () => void; active: boolean }) {
  return (
    <div
      className="relative min-h-[300px] md:min-h-[60vh] overflow-hidden"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <img src={image} alt="" className={"absolute inset-0 w-full h-full object-cover transition-transform duration-500 " + (active ? "scale-105" : "scale-100")} />
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 h-full w-full flex items-center justify-center">
        <Link
          to={to}
          className="rounded-full bg-white px-7 py-4 text-base font-semibold shadow-xl hover:scale-[1.03] active:scale-[0.98] transition-transform"
        >
          {label}
        </Link>
      </div>
    </div>
  );
}
