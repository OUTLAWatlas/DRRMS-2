import NumberBadge from "@/components/NumberBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { useSubmitReportMutation } from "@/hooks/api-hooks";

export default function ReportPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<{
    what: string;
    where: string;
    severity: "Low" | "Moderate" | "High" | "Critical";
    when: string;
  }>({ what: "", where: "", severity: "Moderate", when: "" });
  const submitReport = useSubmitReportMutation();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    submitReport.mutate(
      {
        whatHappened: form.what,
        location: form.where,
        severity: form.severity,
        occurredAt: form.when ? new Date(form.when).toISOString() : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Disaster report submitted successfully");
          // Reset form
          setForm({ what: "", where: "", severity: "Moderate", when: "" });
          // Optionally navigate to a different page
          navigate("/rescue");
        },
        onError: (error) => {
          toast.error(error.message || "Failed to submit report");
        },
      }
    );
  }

  return (
    <div className="py-10 sm:py-14">
      <h1 className="text-center text-3xl sm:text-4xl font-extrabold mb-8">Report a Disaster</h1>
      <div className="container mx-auto max-w-3xl">
        <div className="rounded-xl bg-white text-black p-6 sm:p-8 shadow-xl">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <Label htmlFor="what" className="flex items-center text-base">
                <NumberBadge n={1} /> What happened?
              </Label>
              <Textarea
                id="what"
                required
                placeholder="Describe the situation"
                className="mt-3"
                value={form.what}
                onChange={(e) => setForm((f) => ({ ...f, what: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="where" className="flex items-center text-base">
                <NumberBadge n={2} /> Where did it occur?
              </Label>
              <Input
                id="where"
                required
                placeholder="Address or landmark"
                className="mt-3"
                value={form.where}
                onChange={(e) => setForm((f) => ({ ...f, where: e.target.value }))}
              />
            </div>

            <div>
              <p className="flex items-center text-base mb-3">
                <NumberBadge n={3} /> Severity
              </p>
              <RadioGroup
                defaultValue={form.severity}
                onValueChange={(v) => setForm((f) => ({ ...f, severity: v as "Low" | "Moderate" | "High" | "Critical" }))}
                className="grid grid-cols-2 sm:grid-cols-4 gap-2"
              >
                {(["Low", "Moderate", "High", "Critical"] as const).map((lvl) => (
                  <div key={lvl} className="flex items-center gap-2 rounded-md border p-3">
                    <RadioGroupItem id={lvl} value={lvl} />
                    <label htmlFor={lvl} className="text-sm font-medium leading-none">
                      {lvl}
                    </label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="when" className="flex items-center text-base">
                <NumberBadge n={4} /> When did it occur?
              </Label>
              <Input
                id="when"
                type="datetime-local"
                required
                className="mt-3"
                value={form.when}
                onChange={(e) => setForm((f) => ({ ...f, when: e.target.value }))}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold"
              disabled={submitReport.isPending}
            >
              {submitReport.isPending ? "Submitting..." : "Submit Report"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
