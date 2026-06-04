import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSaveCredentials, useGetCredentialStatus, getGetCredentialStatusQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Settings2, Loader2, CheckCircle2, AlertTriangle, ShieldAlert, ArrowUpRight } from "lucide-react";

const schema = z.object({
  payd_username: z.string().min(1, "API Username is required"),
  payd_password: z.string().min(1, "API Password is required"),
  payd_account_username: z.string().min(1, "Account Username is required"),
  payd_api_secret: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const saveCredentials = useSaveCredentials();
  const [withdrawalToggling, setWithdrawalToggling] = useState(false);
  const { data: status, isLoading } = useGetCredentialStatus({
    query: { queryKey: getGetCredentialStatusQueryKey() },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      payd_username: "",
      payd_password: "",
      payd_account_username: "",
      payd_api_secret: "",
    },
  });

  useEffect(() => {
    if (status?.is_configured) {
      form.reset({
        payd_account_username: status.account_username ?? "",
        payd_username: (status as unknown as Record<string, string>)["payd_username"] ?? "",
        payd_password: (status as unknown as Record<string, string>)["payd_password"] ?? "",
        payd_api_secret: (status as unknown as Record<string, string>)["payd_api_secret"] ?? "",
      });
    }
  }, [status, form]);

  const onSubmit = (data: FormValues) => {
    saveCredentials.mutate(
      {
        data: {
          payd_username: data.payd_username,
          payd_password: data.payd_password,
          payd_account_username: data.payd_account_username,
          payd_api_secret: data.payd_api_secret || null,
        },
      },
      {
        onSuccess: (result) => {
          toast({
            title: "Credentials Saved",
            description: `Saved as: ${result.account_username ?? data.payd_account_username}`,
          });
          void queryClient.invalidateQueries({ queryKey: getGetCredentialStatusQueryKey() });
        },
        onError: (error) => {
          toast({ variant: "destructive", title: "Save Failed", description: error.message });
        },
      }
    );
  };

  const handleWithdrawalsToggle = async (enabled: boolean) => {
    setWithdrawalToggling(true);
    try {
      const res = await fetch("/api/settings/credentials/withdrawals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Failed to update");
      }
      toast({
        title: enabled ? "Withdrawals Enabled" : "Withdrawals Disabled",
        description: enabled
          ? "Users can now initiate withdrawals."
          : "Withdrawals are now blocked for all users.",
      });
      void queryClient.invalidateQueries({ queryKey: getGetCredentialStatusQueryKey() });
    } catch (err) {
      toast({ variant: "destructive", title: "Toggle Failed", description: String(err) });
    } finally {
      setWithdrawalToggling(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings2 className="h-8 w-8 text-primary" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Configure your Payd API credentials.
        </p>
      </header>

      {!isLoading && status?.is_configured && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-5 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="font-semibold text-sm text-primary">Credentials Active</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Connected as{" "}
                <span className="font-mono font-semibold text-foreground">
                  {status.account_username}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !status?.is_configured && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-5 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
            <div>
              <p className="font-semibold text-sm text-yellow-500">No Credentials Set</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enter your Payd API credentials below to get started.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Withdrawals toggle — only shown when credentials are configured */}
      {!isLoading && status?.is_configured && (
        <Card className="border-border shadow-sm bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowUpRight className="h-4 w-4 text-destructive" />
              Withdrawals
            </CardTitle>
            <CardDescription>
              Control whether payout / withdrawal operations are permitted. Disable this to block all withdrawal attempts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {status.withdrawals_enabled ? "Withdrawals are enabled" : "Withdrawals are disabled"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {status.withdrawals_enabled
                    ? "Users can initiate M-Pesa and merchant payouts."
                    : "All withdrawal attempts will be blocked with a generic error."}
                </p>
              </div>
              <Switch
                checked={status.withdrawals_enabled}
                onCheckedChange={handleWithdrawalsToggle}
                disabled={withdrawalToggling}
                aria-label="Toggle withdrawals"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border shadow-sm bg-card">
        <CardHeader>
          <CardTitle>Payd API Credentials</CardTitle>
          <CardDescription>Get these from Payd dashboard → Profile → API Keys.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="payd_account_username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Username</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. techlink" className="font-mono" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Your Payd profile username (not the API key username).
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payd_username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key Username</FormLabel>
                    <FormControl>
                      <Input placeholder="API key username" className="font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payd_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key Password</FormLabel>
                    <FormControl>
                      <Input placeholder="API key password" className="font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payd_api_secret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      API Secret{" "}
                      <span className="text-muted-foreground font-normal">(Optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="API secret (if provided)"
                        className="font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-start gap-2 text-sm pt-1 pb-1">
                <ShieldAlert size={15} className="text-yellow-500 mt-0.5 shrink-0" />
                <p className="text-muted-foreground text-xs">
                  Credentials are encrypted and stored securely in the database, scoped to your account.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-md font-bold"
                disabled={saveCredentials.isPending}
              >
                {saveCredentials.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save Credentials"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
