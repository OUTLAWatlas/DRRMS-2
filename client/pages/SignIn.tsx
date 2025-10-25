import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function SignIn() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) {
      toast.error("Enter a valid mobile number");
      return;
    }
    setLoading(true);
    toast.success("OTP sent to your mobile number");
    setTimeout(() => {
      setLoading(false);
      toast.success("Signed in successfully");
    }, 800);
  }

  return (
    <div className="container mx-auto max-w-lg py-10 sm:py-14">
      <h1 className="text-3xl sm:text-4xl font-extrabold mb-6">Sign In</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-6">
        <div>
          <Label htmlFor="phone">Mobile number</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            placeholder="e.g. +91 98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-2 h-12"
          />
          <p className="mt-2 text-xs text-muted-foreground">We’ll send an OTP to verify your number.</p>
        </div>
        <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
          {loading ? "Sending OTP..." : "Sign In"}
        </Button>
      </form>
    </div>
  );
}
