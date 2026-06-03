import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useInitiateMerchantPayout, getGetAccountQueryKey, getGetSummaryQueryKey } from "@workspace/api-client-react";
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
import { Building2, Loader2, Phone, Store, CheckCircle2, Copy, XCircle } from "lucide-react";

const merchantSchema = z.object({
  business_type: z.enum(["paybill", "till"]),
  business_account: z.string().min(4, "Enter a valid Paybill or Till number"),
  business_number: z.string().optional(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  phone_number: z.string().min(10, "Enter a valid phone number with country code e.g. +254700000000"),
  narration: z.string().min(2, "Narration is required"),
});

type MerchantFormValues = z.infer<typeof merchantSchema>;

export default function Merchant() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const initiateMerchant = useInitiateMerchantPayout();
  const [successRef, setSuccessRef] = useState<string | null>(null);
  const [declinedOpen, setDeclinedOpen] = useState(false);

  const form = useForm<MerchantFormValues>({
    resolver: zodResolver(merchantSchema),
    defaultValues: {
      business_type: "paybill",
      business_account: "",
      business_number: "",
      amount: 0,
      phone_number: "",
      narration: "Payment for goods",
    },
  });

  const businessType = form.watch("business_type");

  const onSubmit = (_data: MerchantFormValues) => {
    // Payments are currently unavailable. Surface the decline notice only when
    // the user actually attempts a payment, rather than as a standing banner.
    setDeclinedOpen(true);
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Building2 className="h-8 w-8 text-primary" />
          Merchant Payment
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Pay to a Paybill or Till (Buy Goods) number via M-Pesa.
        </p>
      </header>

      {successRef && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-sm text-primary">Payment Accepted</p>
                <p className="text-xs text-muted-foreground mt-0.5">Correlator ID (use this to track status):</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="font-mono text-xs bg-secondary px-2 py-1 rounded truncate">{successRef}</code>
                  <button
                    onClick={() => { void navigator.clipboard.writeText(successRef); }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border shadow-sm bg-card">
        <CardHeader>
          <CardTitle>Business Payment</CardTitle>
          <CardDescription>
            Funds are debited from your Payd KES wallet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* Business type selector */}
              <FormField
                control={form.control}
                name="business_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Type</FormLabel>
                    <div className="grid grid-cols-2 gap-2">
                      {(["paybill", "till"] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => field.onChange(type)}
                          className={`flex items-center gap-2 px-4 py-3 rounded-md border text-sm font-medium transition-colors ${
                            field.value === type
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-muted-foreground"
                          }`}
                        >
                          {type === "paybill" ? <Building2 size={16} /> : <Store size={16} />}
                          {type === "paybill" ? "Paybill" : "Till (Buy Goods)"}
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="business_account"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{businessType === "paybill" ? "Paybill Number" : "Till Number"}</FormLabel>
                    <FormControl>
                      <Input placeholder={businessType === "paybill" ? "e.g. 247247" : "e.g. 5432100"} className="font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {businessType === "paybill" && (
                <FormField
                  control={form.control}
                  name="business_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 0000000000000" className="font-mono" {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">Account reference under the Paybill number.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="phone_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sender Phone Number</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="+254700000000" className="pl-9 font-mono" {...field} />
                      </div>
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Phone number with country code (e.g. +254700000000).</p>
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
                    <FormLabel>Narration</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Payment for goods" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-12 text-md font-bold"
                disabled={initiateMerchant.isPending}
              >
                {initiateMerchant.isPending ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
                ) : (
                  `Pay to ${businessType === "paybill" ? "Paybill" : "Till"}`
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
