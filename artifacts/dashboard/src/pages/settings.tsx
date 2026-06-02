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
import { useToast } from "@/hooks/use-toast";
import { Settings2, Loader2, CheckCircle2, AlertTriangle, Eye, EyeOff, ShieldAlert, Info } from "lucide-react";

const schema = z.object({
  payd_username: z.string().min(1, "API Username is required"),
  payd_password: z.string().min(1, "API Password is required"),
  payd_account_username: z.string().min(1, "Account Username is required"),
  payd_api_secret: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function PasswordInput({ placeholder, field }: { placeholder: string; field: React.InputHTMLAttributes<HTMLInputElement> & { ref: React.Ref<HTMLInputElement> } }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} placeholder={placeholder} className="pr-10 font-mono" {...field} />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const saveCredentials = useSaveCredentials();
  const { data: status } = useGetCredentialStatus({
    query: { queryKey: getGetCredentialStatusQueryKey() }
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
            description: `Connected as: ${result.account_username ?? data.payd_account_username}`,
          });
          form.reset();
          void queryClient.invalidateQueries({ queryKey: getGetCredentialStatusQueryKey() });
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Save Failed",
            description: error.message,
          });
        },
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings2 className="h-8 w-8 text-primary" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Configure your Payd API credentials. These are stored in the database.
        </p>
      </header>

      {/* Current status */}
      {status?.is_configured && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-5 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="font-semibold text-sm text-primary">Credentials Active</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Connected as <span className="font-mono font-semibold text-foreground">{status.account_username}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!status?.is_configured && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-5 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
            <div>
              <p className="font-semibold text-sm text-yellow-500">No Credentials Set</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                The system won't be able to fetch balances until credentials are saved below.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notice */}
      <Card className="border-border bg-secondary/20">
        <CardContent className="pt-5 space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <Info size={15} className="text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-muted-foreground">
              Credentials are saved to <span className="text-foreground font-medium">local storage only</span> and are 
              never transmitted or stored on any server.
            </p>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <ShieldAlert size={15} className="text-yellow-500 mt-0.5 shrink-0" />
            <p className="text-muted-foreground">
              <span className="text-yellow-500 font-medium">Session notice:</span> Credentials will be automatically deleted 
              when you clear your browser cache or close your browser. You will need to re-enter them next session.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm bg-card">
        <CardHeader>
          <CardTitle>Payd API Credentials</CardTitle>
          <CardDescription>
            Get these from your Payd dashboard → Profile → API Keys.
          </CardDescription>
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
                    <p className="text-xs text-muted-foreground">Your Payd profile username (not the API key username).</p>
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
                      <PasswordInput placeholder="API key password" field={field as Parameters<typeof PasswordInput>[0]["field"]} />
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
                    <FormLabel>API Secret <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                    <FormControl>
                      <PasswordInput placeholder="API secret (if provided)" field={field as Parameters<typeof PasswordInput>[0]["field"]} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-12 text-md font-bold"
                disabled={saveCredentials.isPending}
              >
                {saveCredentials.isPending ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...</>
                ) : "Save Credentials"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
