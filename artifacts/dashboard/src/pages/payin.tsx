import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useInitiatePayin, getGetSummaryQueryKey, getGetAccountQueryKey, getGetTransactionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowDownLeft, Loader2, Phone } from "lucide-react";

const payinSchema = z.object({
  phone_number: z.string().min(9, "Valid phone number required (e.g. 254712345678)"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  narration: z.string().optional(),
});

type PayinFormValues = z.infer<typeof payinSchema>;

export default function Payin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const initiatePayin = useInitiatePayin();

  const form = useForm<PayinFormValues>({
    resolver: zodResolver(payinSchema),
    defaultValues: {
      phone_number: "",
      amount: 0,
      narration: "",
    },
  });

  const onSubmit = (data: PayinFormValues) => {
    initiatePayin.mutate(
      { 
        data: {
          phone_number: data.phone_number,
          amount: data.amount,
          currency: "KES",
          channel: "MPESA",
          narration: data.narration || "Deposit to account"
        }
      },
      {
        onSuccess: (result) => {
          if (result.success) {
            toast({
              title: "Deposit Initiated",
              description: "STK push sent to phone. Check handset to complete.",
            });
            form.reset();
            // Invalidate queries to update balances
            queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey() });
          } else {
            toast({
              variant: "destructive",
              title: "Deposit Failed",
              description: result.message || "Unknown error occurred",
            });
          }
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "API Error",
            description: error.message || "Failed to connect to provider",
          });
        }
      }
    );
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ArrowDownLeft className="h-8 w-8 text-primary" />
          Deposit Funds
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Initiate an M-Pesa STK push to a customer's phone to collect funds.
        </p>
      </header>

      <Card className="border-border shadow-sm bg-card">
        <CardHeader>
          <CardTitle>M-Pesa STK Push</CardTitle>
          <CardDescription>
            The user will receive a prompt on their phone to enter their M-Pesa PIN.
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
                    <FormLabel>Phone Number</FormLabel>
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
                      <Input placeholder="e.g. Invoice INV-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full h-12 text-md font-bold" 
                disabled={initiatePayin.isPending}
              >
                {initiatePayin.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Initiating Request...
                  </>
                ) : (
                  "Send Payment Request"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
