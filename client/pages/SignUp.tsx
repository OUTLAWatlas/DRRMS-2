import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRegisterMutation } from "@/hooks/api-hooks";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const navigate = useNavigate();
  const register = useRegisterMutation();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return toast.error("Please fill email and password");
    register.mutate(
      { name, email, password, role: "survivor" },
      {
        onSuccess: () => {
          toast.success("Account created. Please sign in.");
          navigate("/signin");
        },
        onError: (err: any) => {
          toast.error(err?.message || "Failed to register");
        },
      },
    );
  }

  return (
    <div className="container mx-auto max-w-lg py-10 sm:py-14">
      <h1 className="text-3xl sm:text-4xl font-extrabold mb-6">Create account</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-6">
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} className="mt-2 h-12" />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 h-12" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" placeholder="Choose a password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 h-12" />
        </div>
        <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={register.isPending}>
          {register.isPending ? "Creating..." : "Create account"}
        </Button>
      </form>
    </div>
  );
}
