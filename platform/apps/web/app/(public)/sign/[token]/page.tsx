"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

export default function SignPage() {
  const params = useParams();
  const token = params.token as string;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"idle" | "signed" | "declined" | "error">("idle");

  const submit = async (status: "signed" | "declined") => {
    setLoading(true);
    try {
      const res = await fetch("/api/signatures/webhooks/internal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          status,
          recipientEmail: email || undefined,
          metadata: { signer: name }
        })
      });
      if (!res.ok) throw new Error("Failed");
      setResult(status);
    } catch (err) {
      setResult("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Review and Sign</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">Confirm your details and acknowledge the park rules and waiver to complete your long-term stay paperwork.</p>

            <div className="space-y-2">
              <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Email for receipt" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="flex items-start gap-2 rounded border border-slate-200 bg-slate-50 p-3">
              <Checkbox id="accept" checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} />
              <label htmlFor="accept" className="text-sm text-slate-700">
                I have reviewed the long-term stay agreement, park rules, deposit/fee summary, waiver, and COI requirements.
              </label>
            </div>

            {result === "signed" && <div className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Thank you! Your signature is recorded.</div>}
            {result === "declined" && <div className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-700">You declined this request. The park will be notified.</div>}
            {result === "error" && <div className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">Something went wrong. Please try again.</div>}

            <div className="flex flex-wrap gap-2">
              <Button disabled={!accepted || loading} onClick={() => submit("signed")}>
                {loading ? "Submitting..." : "Sign and submit"}
              </Button>
              <Button variant="outline" disabled={loading} onClick={() => submit("declined")}>
                Decline
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
