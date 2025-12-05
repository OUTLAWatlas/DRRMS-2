import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { useForgotPasswordMutation } from "@/hooks/api-hooks";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const forgotPassword = useForgotPasswordMutation();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email) {
      toast.error("Please enter the email associated with your account");
      return;
    }

    forgotPassword.mutate(
      { email },
      {
        onSuccess: (data) => {
          toast.success(data.message || "Check your inbox for reset instructions");
        },
        onError: (error) => {
          toast.error(error.message || "Unable to initiate password reset");
        },
      },
    );
  };

  return (
    <div className="container mx-auto max-w-2xl py-10 sm:py-14">
      <h1 className="text-3xl sm:text-4xl font-extrabold mb-4">Forgot password</h1>
      <p className="text-muted-foreground mb-8">
        Enter the email tied to your DRRMS account and we will send you a secure link to create a new password.
      </p>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_minmax(0,0.9fr)]">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Password reset</CardTitle>
              <CardDescription>We will send a reset link if the email is registered.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Account email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.org"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12"
                  disabled={forgotPassword.isPending}
                />
              </div>
              <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={forgotPassword.isPending}>
                {forgotPassword.isPending ? "Sending reset link..." : "Send reset link"}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Remembered your password? <Link to="/signin" className="text-brand underline-offset-4 hover:underline">Back to sign in</Link>
              </p>
            </CardContent>
          </Card>
        </form>

        <Alert className="self-start border-brand/30 bg-brand/5">
          <Info className="h-4 w-4" />
          <AlertTitle>Need immediate help?</AlertTitle>
          <AlertDescription>
            If you no longer have access to this email, contact the DRRMS operations desk at
            <a href="mailto:support@drrms.org" className="mx-1 underline">support@drrms.org</a>
            so we can quickly verify your identity.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
