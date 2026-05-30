import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useGetPayheroWallet,
  useInitiatePayheroWithdraw,
  getGetPayheroWalletQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Zap, Loader2, Phone, RefreshCw, AlertCircle, Wallet, ArrowUpRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

const withdrawSchema = z.object({
  phone_number: z
    .string()
    .min(12, "Phone must be in international format e.g. 254712345678")
    .regex(/^254\d{9}$/, "Phone must start with 254 and be 12 digits (e.g. 254712345678)"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  network_code: z.string().default("63902"),
  external_reference: z.string().optional(),
});

type WithdrawFormValues = z.infer<typeof withdrawSchema>;

function BalanceCard({
  label,
  amount,
  currency,
  isLoading,
}: {
  label: string;
  amount: number | null | undefined;
  currency: string;
  isLoading: boolean;
}) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="pt-6">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
        {isLoading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <p className="text-3xl font-bold font-mono">
            {amount == null ? (
              <span className="text-muted-foreground text-lg">—</span>
            ) : (
              <>
                <span className="text-sm font-semibold text-muted-foreground mr-1">{currency}</span>
                {amount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function PayHero() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: wallet, isLoading: walletLoading, error: walletError, refetch } = useGetPayheroWallet();
  const withdraw = useInitiatePayheroWithdraw();

  const form = useForm<WithdrawFormValues>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: {
      phone_number: "",
      amount: 0,
      network_code: "63902",
      external_reference: "",
    },
  });

  const onSubmit = (data: WithdrawFormValues) => {
    withdraw.mutate(
      {
        data: {
          phone_number: data.phone_number,
          amount: data.amount,
          network_code: data.network_code,
          external_reference: data.external_reference || null,
        },
      },
      {
        onSuccess: (result) => {
          if (result.success) {
            toast({
              title: "Withdrawal Initiated",
              description: result.reference
                ? `Reference: ${result.reference}`
                : result.message,
            });
            form.reset();
            queryClient.invalidateQueries({ queryKey: getGetPayheroWalletQueryKey() });
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
            description: error.message || "Failed to connect to PayHero",
          });
        },
      }
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-8 w-8 text-primary" />
            PayHero
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage your PayHero wallet — check balances and withdraw to mobile money.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={walletLoading}
          className="gap-2"
        >
          <RefreshCw size={14} className={walletLoading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </header>

      {/* Connection error */}
      {walletError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>PayHero Connection Error</AlertTitle>
          <AlertDescription>
            {walletError.message || "Could not reach PayHero API. Check that PAYHERO_AUTH_TOKEN and PAYHERO_CHANNEL_ID are set correctly."}
          </AlertDescription>
        </Alert>
      )}

      {/* Wallet Balances */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Wallet size={14} />
          Wallet Balances
          {wallet && (
            <span className="text-xs font-mono text-muted-foreground/60">
              Channel #{wallet.channel_id}{wallet.channel_name ? ` · ${wallet.channel_name}` : ""}
            </span>
          )}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <BalanceCard
            label="Payments Wallet"
            amount={wallet?.payment_channel_balance}
            currency={wallet?.currency ?? "KES"}
            isLoading={walletLoading}
          />
          <BalanceCard
            label="Service Wallet"
            amount={wallet?.service_wallet_balance}
            currency={wallet?.currency ?? "KES"}
            isLoading={walletLoading}
          />
        </div>
      </section>

      {/* Withdraw form */}
      <section>
        <Card className="border-border shadow-sm bg-card max-w-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpRight size={18} />
              Withdraw to Mobile
            </CardTitle>
            <CardDescription>
              Send funds from your PayHero wallet to M-Pesa or Airtel Money.
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
                          <Input
                            placeholder="254712345678"
                            className="pl-9 font-mono"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        International format starting with 254 (Kenya country code)
                      </p>
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
                          <Input
                            type="number"
                            placeholder="0.00"
                            className="pl-12 font-mono text-lg"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="network_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Network</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select network" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="63902">M-Pesa</SelectItem>
                          <SelectItem value="63903">Airtel Money</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="external_reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. WD-001 or invoice ref" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-12 text-md font-bold"
                  disabled={withdraw.isPending}
                >
                  {withdraw.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing Withdrawal...
                    </>
                  ) : (
                    "Withdraw Funds"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
