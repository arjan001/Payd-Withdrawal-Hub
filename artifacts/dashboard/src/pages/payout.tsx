import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useInitiatePayout, getGetSummaryQueryKey, getGetAccountQueryKey, getGetTransactionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowUpRight, Loader2, Phone } from "lucide-react";

const payoutSchema = z.object({
  phone_number: z.string().min(9, "Valid phone number required (e.g. 254712345678)"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  narration: z.string().optional(),
});

type PayoutFormValues = z.infer<typeof payoutSchema>;

export default function Payout() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const initiatePayout = useInitiatePayout();

  const form = useForm<PayoutFormValues>({
    resolver: zodResolver(payoutSchema),
    defaultValues: {
      phone_number: "",
      amount: 0,
      narration: "",
    },
  });

  const onSubmit = (data: PayoutFormValues) => {
    initiatePayout.mutate(
      { 
        data: {
          phone_number: data.phone_number,
          amount: data.amount,
          currency: "KES",
          network_code: "MPESA",
          narration: data.narration || "Withdrawal from account"
        }
      },
      {
        onSuccess: (result) => {
          if (result.success) {
            toast({
              title: "Withdrawal Initiated",
              description: "Funds are being transferred to the mobile number.",
            });
            form.reset();
            queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey() });
          } else {
            toast({
              variant: "destructive",
              title: "Withdrawal Failed",
              description: result.message || "Unknown error occurred",
            });
          }
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "API Error",
            description: error.message || "Failed to process withdrawal",
          });
        }
      }
    );
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
                        <Input placeholder="254712345678" className="pl-9 font-mono" {...field} />
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
                disabled={initiatePayout.isPending}
              >
                {initiatePayout.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Send Funds Now"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
