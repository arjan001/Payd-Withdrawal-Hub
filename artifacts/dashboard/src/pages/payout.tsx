import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Phone, Lock } from "lucide-react";

const payoutSchema = z.object({
  phone_number: z.string().min(9, "Valid phone number required (e.g. 254712345678)"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  narration: z.string().optional(),
});

type PayoutFormValues = z.infer<typeof payoutSchema>;

export default function Payout() {
  const form = useForm<PayoutFormValues>({
    resolver: zodResolver(payoutSchema),
    defaultValues: {
      phone_number: "",
      amount: 0,
      narration: "",
    },
  });

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
      </header>

      <Card className="border-border shadow-sm bg-card border-t-destructive/50 opacity-60 pointer-events-none select-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Mobile Money Transfer
            <span className="ml-auto flex items-center gap-1 text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">
              <Lock size={11} /> DISABLED
            </span>
          </CardTitle>
          <CardDescription>
            Withdrawals are currently disabled. Contact your administrator to enable payout access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-6">
              <FormField
                control={form.control}
                name="phone_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient Phone Number</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="254712345678" className="pl-9 font-mono" {...field} disabled />
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
                        <Input type="number" placeholder="0.00" className="pl-12 font-mono text-lg" {...field} disabled />
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
                      <Input placeholder="e.g. Salary payout" {...field} disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="button"
                variant="destructive"
                className="w-full h-12 text-md font-bold"
                disabled
              >
                <Lock className="mr-2 h-4 w-4" />
                Withdrawals Unavailable
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
