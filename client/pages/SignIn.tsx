import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useLoginMutation } from "@/hooks/api-hooks";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const loginMutation = useLoginMutation();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    loginMutation.mutate(
      { email, password },
      {
        onSuccess: (data) => {
          toast.success("Signed in successfully");
          
          // Navigate based on user role
          if (data.user.role === "survivor") {
            navigate("/request");
          } else if (data.user.role === "rescuer") {
            navigate("/rescue");
          } else if (data.user.role === "admin") {
            navigate("/resources");
          } else {
            navigate("/");
          }
        },
        onError: (error) => {
          toast.error(error.message || "Failed to sign in");
        },
      }
    );
  }

  return (
    <div className="container mx-auto max-w-lg py-10 sm:py-14">
      <h1 className="text-3xl sm:text-4xl font-extrabold mb-6">Sign In</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-6">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 h-12"
            disabled={loginMutation.isPending}
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 h-12"
            disabled={loginMutation.isPending}
          />
        </div>
        <Button 
          type="submit" 
          className="w-full h-12 text-base font-semibold" 
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? "Signing in..." : "Sign In"}
        </Button>
        
        <p className="mt-4 text-xs text-muted-foreground text-center">
          Test credentials: rescuer@drrms.org / password123
        </p>
      </form>
    </div>
  );
}
