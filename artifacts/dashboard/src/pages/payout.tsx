import { useState } from "react";
import { useGetAccount } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowUpRight, CheckCircle2, Loader2, Phone, XCircle } from "lucide-react";

const payoutSchema = z.object({
  phone_number: z.string().min(10, "Valid Kenyan phone required (e.g. 0797923494)"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  narration: z.string().optional(),
});

type PayoutFormValues = z.infer<typeof payoutSchema>;

export default function Payout() {
  const { data: account } = useGetAccount();
  const [processing, setProcessing] = useState(false);
  const [failedOpen, setFailedOpen] = useState(false);
  const [failedMessage, setFailedMessage] = useState("");
  const [successOpen, setSuccessOpen] = useState(false);
  const [successRef, setSuccessRef] = useState<string>("");

  const form = useForm<PayoutFormValues>({
    resolver: zodResolver(payoutSchema),
    defaultValues: {
      phone_number: "",
      amount: 0,
      narration: "",
    },
  });

  const onSubmit = async (data: PayoutFormValues) => {
    setProcessing(true);
    try {
      const res = await fetch("/api/payd/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: data.phone_number,
          amount: data.amount,
          narration: data.narration || undefined,
        }),
      });

      const json = await res.json() as {
        reference?: string;
        message?: string;
        error?: string;
        success?: boolean;
        account?: string;
        payd_account_username?: string;
        api_username?: string;
        user_id?: number;
      };

      if (!res.ok || json.success === false) {
        const paydAccount = json.payd_account_username ?? json.account ?? account?.username;
        const api = json.api_username ? ` · API: ${json.api_username}` : "";
        const who = paydAccount ? `${paydAccount}${api}` : "Withdrawal";
        const detail = json.message ?? json.error ?? "Unable to process the withdrawal at this time. Please try again later.";
        setFailedMessage(`${who}: ${detail}`);
        setFailedOpen(true);
        return;
      }

      setSuccessRef(json.reference ?? "");
      setSuccessOpen(true);
      form.reset();
    } catch {
      setFailedMessage("Network error. Please check your connection and try again.");
      setFailedOpen(true);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ArrowUpRight className="h-8 w-8 text-destructive" />
          Withdraw Funds
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Send money from your Payd balance directly to a mobile money wallet.
        </p>
        {account?.connected && account.username && (
          <p className="text-xs font-mono mt-2 text-primary">
            Withdrawing from: {account.username}
            {account.balances[0] != null && (
              <span className="text-muted-foreground ml-2">
                (KES {account.balances[0].available_balance.toLocaleString()})
              </span>
            )}
          </p>
        )}
        {account && !account.connected && (
          <p className="text-xs text-yellow-500 mt-2">
            Credentials not linked to your login — go to Settings and save your Payd API keys.
          </p>
        )}
      </header>

      <Card className="border-border shadow-sm bg-card border-t-destructive/50">
        <CardHeader>
          <CardTitle>Mobile Money Transfer</CardTitle>
          <CardDescription>
            Transfers are processed immediately. Ensure you have sufficient available balance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              <FormField
                control={form.control}
                name="phone_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient Phone Number</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="0797923494" className="pl-9 font-mono" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (KES)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-sm font-medium text-muted-foreground">KES</span>
                        <Input type="number" placeholder="0.00" className="pl-12 font-mono text-lg" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="narration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Narration (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Salary payout" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                variant="destructive"
                className="w-full h-12 text-md font-bold"
                disabled={processing}
              >
                {processing ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
                ) : (
                  "Send Funds Now"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Generic failure dialog — shown for ANY error including disabled withdrawals */}
      <AlertDialog open={failedOpen} onOpenChange={setFailedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5 shrink-0" />
              Transaction Failed
            </AlertDialogTitle>
            <AlertDialogDescription>
              {failedMessage || "Unable to process the withdrawal at this time. Please try again later."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Success dialog */}
      <AlertDialog open={successOpen} onOpenChange={setSuccessOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              Withdrawal Initiated
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your withdrawal has been submitted successfully.
              {successRef && (
                <span className="block mt-2 font-mono text-xs text-foreground">
                  Reference: {successRef}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Done</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
