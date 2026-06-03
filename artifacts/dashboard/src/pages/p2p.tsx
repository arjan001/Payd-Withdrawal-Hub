import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useInitiateP2PTransfer, getGetAccountQueryKey, getGetSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import { Users, Loader2, Phone, AtSign, CheckCircle2, Copy, Zap, XCircle } from "lucide-react";

const p2pSchema = z.object({
  receiver_username: z.string().min(2, "Enter the recipient's Payd username"),
  phone_number: z.string().min(10, "Enter a valid phone number with country code e.g. +254700000000"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  narration: z.string().min(2, "Narration is required"),
  wallet_type: z.enum(["local", "USD"]).optional(),
});

type P2PFormValues = z.infer<typeof p2pSchema>;

export default function P2P() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const initiateP2P = useInitiateP2PTransfer();
  const [successRef, setSuccessRef] = useState<string | null>(null);
  const [declinedOpen, setDeclinedOpen] = useState(false);

  const form = useForm<P2PFormValues>({
    resolver: zodResolver(p2pSchema),
    defaultValues: {
      receiver_username: "",
      phone_number: "",
      amount: 0,
      narration: "",
      wallet_type: "local",
    },
  });

  const walletType = form.watch("wallet_type");

  const onSubmit = (_data: P2PFormValues) => {
    // Transfers are currently unavailable. Surface the decline notice only when
    // the user actually attempts a transfer, rather than as a standing banner.
    setDeclinedOpen(true);
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-8 w-8 text-primary" />
          Send to Payd Member
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Instant zero-fee transfer to any Payd account. Completes immediately.
        </p>
      </header>

      {successRef && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-sm text-primary">Transfer Completed</p>
                {successRef !== "confirmed" && (
                  <>
                    <p className="text-xs text-muted-foreground mt-0.5">Transaction Reference:</p>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="font-mono text-xs bg-secondary px-2 py-1 rounded truncate">{successRef}</code>
                      <button
                        onClick={() => { void navigator.clipboard.writeText(successRef); }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border shadow-sm bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap size={18} className="text-primary" />
            Instant Transfer
          </CardTitle>
          <CardDescription>
            No fees. Transfers complete immediately — no webhook needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              <FormField
                control={form.control}
                name="receiver_username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient Payd Username</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <AtSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="e.g. janedoe" className="pl-9 font-mono" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient Phone Number</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="+254700000000" className="pl-9 font-mono" {...field} />
                      </div>
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Phone associated with the recipient's Payd account.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount ({walletType === "USD" ? "USD" : "KES"})</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-sm font-medium text-muted-foreground">
                          {walletType === "USD" ? "USD" : "KES"}
                        </span>
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
                    <FormLabel>Narration</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Family breakfast" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="wallet_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source Wallet</FormLabel>
                    <div className="grid grid-cols-2 gap-2">
                      {(["local", "USD"] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => field.onChange(type)}
                          className={`px-4 py-2.5 rounded-md border text-sm font-medium transition-colors ${
                            field.value === type
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-muted-foreground"
                          }`}
                        >
                          {type === "local" ? "KES Wallet" : "USD Wallet"}
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-12 text-md font-bold"
                disabled={initiateP2P.isPending}
              >
                {initiateP2P.isPending ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Sending...</>
                ) : (
                  "Send Transfer"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <AlertDialog open={declinedOpen} onOpenChange={setDeclinedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5 shrink-0" />
              Payout Declined by Payd
            </AlertDialogTitle>
            <AlertDialogDescription>
              API withdrawals are currently unavailable. Please contact Payd support to enable payouts on your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
