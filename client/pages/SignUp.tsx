import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRegisterMutation } from "@/hooks/api-hooks";

const ROLE_HOME: Record<string, string> = {
  survivor: "/user",
  rescuer: "/rescue",
  admin: "/admin",
};

const ROLE_OPTIONS: { value: "survivor" | "rescuer"; title: string; description: string }[] = [
  {
    value: "survivor",
    title: "Resident / Survivor",
    description: "Request aid, report incidents, and track responses in your area.",
  },
  {
    value: "rescuer",
    title: "Responder / Rescuer",
    description: "Coordinate deployments, update missions, and close requests. Requires admin approval before access.",
  },
];

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"survivor" | "rescuer">("survivor");
  const navigate = useNavigate();
  const register = useRegisterMutation();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Please provide your full name");
    if (!email) return toast.error("Email is required");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirmPassword) return toast.error("Passwords do not match");

    register.mutate(
      { name: name.trim(), email: email.trim(), password, role },
      {
        onSuccess: (data) => {
          if ("pendingApproval" in data && data.pendingApproval) {
            toast.success(
              data.message ||
                "Your rescuer application was received. An administrator will review and notify you once approved.",
            );
            navigate("/signin", { replace: true });
            return;
          }

          if (!("user" in data)) {
            toast.error("Unable to finish registration. Please try again.");
            return;
          }

          toast.success("Account created! Redirecting to your portal...");
          const destination = ROLE_HOME[data.user.role] ?? "/";
          navigate(destination, { replace: true });
        },
        onError: (err: any) => {
          toast.error(err?.message || "Failed to register");
        },
      },
    );
  }

  const isSubmitting = register.isPending;

  return (
    <div className="container mx-auto max-w-3xl py-10 sm:py-14">
      <h1 className="text-3xl sm:text-4xl font-extrabold mb-4">Create your DRRMS account</h1>
      <p className="text-muted-foreground mb-8">
        Choose the role that best fits your responsibilities so we can tailor the dashboard and permissions appropriately.
      </p>

      <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[1.15fr_minmax(0,0.85fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Account details</CardTitle>
            <CardDescription>We use this information to personalize alerts and speed up field coordination.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 h-12"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 h-12"
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 h-12"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-2 h-12"
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create account"}
            </Button>
            {role === "rescuer" && (
              <p className="text-xs text-amber-600 text-center">
                Rescuer registrations must be approved by an administrator before you can sign in.
              </p>
            )}
            <p className="text-sm text-center text-muted-foreground">
              Already registered?{" "}
              <Link to="/signin" className="text-brand underline-offset-4 hover:underline">
                Sign in here
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Pick your role</CardTitle>
            <CardDescription>Controls access to the appropriate dashboard tools.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={role}
              onValueChange={(value) => setRole(value as "survivor" | "rescuer")}
              className="gap-4"
            >
              {ROLE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  htmlFor={`role-${option.value}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                    role === option.value ? "border-brand bg-brand/5" : "border-border hover:border-foreground/40",
                  )}
                >
                  <RadioGroupItem id={`role-${option.value}`} value={option.value} className="mt-1" disabled={isSubmitting} />
                  <div>
                    <p className="font-semibold">{option.title}</p>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
            <p className="mt-4 text-xs text-muted-foreground">
              Need administrative access? Request an invite from the DRRMS coordination center—they will provision admin accounts manually for security.
            </p>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
