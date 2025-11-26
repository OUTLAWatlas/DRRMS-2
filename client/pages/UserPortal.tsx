import { Link, useNavigate } from "react-router-dom";

export default function UserPortal() {
  const navigate = useNavigate();
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
          <div className="flex flex-wrap gap-6 justify-center">
            <Link to="/request" className="rounded-full bg-white px-6 py-3 font-semibold shadow-lg">REQUEST HELP</Link>
            <Link to="/resources" className="rounded-full bg-white px-6 py-3 font-semibold shadow-lg">RESOURCES</Link>
            <button
              onClick={() => navigate("/request", { state: { fromReport: true } })}
              className="rounded-full bg-white px-6 py-3 font-semibold shadow-lg"
            >
              REPORT DISASTER
            </button>
          </div>
        </div>
      </div>

      <section className="py-12 text-center">
        <p className="text-muted-foreground">Use the buttons above to navigate to the respective portals.</p>
      </section>
    </div>
  );
}
