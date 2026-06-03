import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSaveCredentials, useGetCredentialStatus, getGetCredentialStatusQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";

const schema = z.object({
  payd_account_username: z.string().min(1, "Account username is required"),
  payd_username: z.string().min(1, "API username is required"),
  payd_password: z.string().min(1, "API password is required"),
  payd_api_secret: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function CredentialsPrompt() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: status, isLoading } = useGetCredentialStatus({
    query: { queryKey: getGetCredentialStatusQueryKey() },
  });
  const saveCredentials = useSaveCredentials();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      payd_account_username: "",
      payd_username: "",
      payd_password: "",
      payd_api_secret: "",
    },
  });

  useEffect(() => {
    if (isLoading || !status) return;
    if (!status.is_configured) {
      setOpen(true);
    }
  }, [status, isLoading]);

  const onSubmit = (data: FormValues) => {
    saveCredentials.mutate(
      {
        data: {
          payd_account_username: data.payd_account_username,
          payd_username: data.payd_username,
          payd_password: data.payd_password,
          payd_api_secret: data.payd_api_secret || null,
        },
      },
      {
        onSuccess: (result) => {
          toast({
            title: "Credentials Saved",
            description: `Connected as ${result.account_username ?? data.payd_account_username}`,
          });
          void queryClient.invalidateQueries({ queryKey: getGetCredentialStatusQueryKey() });
          setOpen(false);
        },
        onError: (error) => {
          toast({ variant: "destructive", title: "Save Failed", description: error.message });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Set up your API credentials
          </DialogTitle>
          <DialogDescription>
            Enter your Payd API credentials to start viewing balances and making deposits. Credentials are stored securely in the database.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
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
                    <Input placeholder="API key password" className="font-mono" type="password" {...field} />
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
                    API Secret <span className="text-muted-foreground font-normal">(Optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="API secret (if provided)" className="font-mono" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
                Later
              </Button>
              <Button type="submit" className="flex-1" disabled={saveCredentials.isPending}>
                {saveCredentials.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" /> Save & Connect
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
