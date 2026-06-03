import { useState } from "react";
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
import { Building2, Loader2, Phone, Store, XCircle } from "lucide-react";

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
  const [processing, setProcessing] = useState(false);
  const [failedOpen, setFailedOpen] = useState(false);

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
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setFailedOpen(true);
    }, 1800);
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
                disabled={processing}
              >
                {processing ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
                ) : (
                  `Pay to ${businessType === "paybill" ? "Paybill" : "Till"}`
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <AlertDialog open={failedOpen} onOpenChange={setFailedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5 shrink-0" />
              Transaction Failed
            </AlertDialogTitle>
            <AlertDialogDescription>
              Unable to process the payment at this time. Please try again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
