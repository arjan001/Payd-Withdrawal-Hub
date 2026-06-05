import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield, RefreshCw, AlertTriangle, Copy,
  ToggleLeft, ToggleRight, Users, Star, Trash2,
  ArrowUpRight, Wallet, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface UserRow {
  id: number;
  user_id: number | null;
  payd_account_username: string;
  payd_username: string;
  payd_password: string;
  payd_api_secret: string | null;
  is_active: boolean;
  withdrawals_enabled: boolean;
  created_at: string;
  updated_at: string;
  kes_available: number | null;
  kes_ledger: number | null;
  usd_available: number | null;
  usd_ledger: number | null;
  balance_error: string | null;
}

const withdrawSchema = z.object({
  credential_id: z.string().min(1, "Select an account"),
  phone_number: z.string().min(9, "Valid phone number required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  narration: z.string().optional(),
});

type WithdrawFormValues = z.infer<typeof withdrawSchema>;

function formatKes(amount: number | null | undefined) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(amount);
}

function formatUsd(amount: number | null | undefined) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function CopyCell({ value }: { value: string | null }) {
  const { toast } = useToast();
  if (!value) return <span className="text-muted-foreground italic text-xs">—</span>;
  return (
    <div className="flex items-center gap-1.5 group max-w-[160px]">
      <code className="font-mono text-xs truncate">{value}</code>
      <button
        onClick={() => {
          void navigator.clipboard.writeText(value);
          toast({ title: "Copied" });
        }}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0"
      >
        <Copy size={12} />
      </button>
    </div>
  );
}

export default function AdminPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const { data: users, isLoading, refetch, isRefetching } = useQuery<UserRow[]>({
    queryKey: ["test-users"],
    queryFn: async () => {
      const res = await fetch("/api/test/users");
      if (!res.ok) throw new Error("Failed to load users");
      return res.json() as Promise<UserRow[]>;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["test-users"] });

  const withdrawForm = useForm<WithdrawFormValues>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: {
      credential_id: "",
      phone_number: "",
      amount: 0,
      narration: "",
    },
  });

  const selectedId = withdrawForm.watch("credential_id");
  const selectedUser = users?.find((u) => String(u.id) === selectedId);

  const setActive = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/test/users/${id}/active`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to set active");
    },
    onSuccess: (_, id) => {
      toast({ title: "Active Credentials Updated", description: `Credentials #${id} marked active.` });
      void invalidate();
    },
    onError: (err) => toast({ variant: "destructive", title: "Error", description: String(err) }),
  });

  const toggleWithdrawals = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      const res = await fetch(`/api/test/users/${id}/withdrawals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawals_enabled: enabled }),
      });
      if (!res.ok) throw new Error("Failed to update");
    },
    onSuccess: (_, { id, enabled }) => {
      toast({
        title: enabled ? "Withdrawals Enabled" : "Withdrawals Disabled",
        description: `Credentials #${id} withdrawal access updated.`,
      });
      void invalidate();
    },
    onError: (err) => toast({ variant: "destructive", title: "Error", description: String(err) }),
  });

  const adminWithdraw = useMutation({
    mutationFn: async (data: WithdrawFormValues) => {
      const res = await fetch(`/api/test/users/${data.credential_id}/payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: data.phone_number,
          amount: data.amount,
          narration: data.narration || undefined,
        }),
      });
      const json = await res.json() as { message?: string; reference?: string; error?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Withdrawal failed");
      return json;
    },
    onSuccess: (json) => {
      toast({
        title: "Withdrawal Submitted",
        description: json.reference
          ? `Reference: ${json.reference}`
          : (json.message ?? "Payout initiated"),
      });
      withdrawForm.reset({ credential_id: "", phone_number: "", amount: 0, narration: "" });
      void invalidate();
    },
    onError: (err) => toast({ variant: "destructive", title: "Withdrawal Failed", description: String(err) }),
  });

  const deleteUser = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/test/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      toast({ title: "Credentials Deleted" });
      setConfirmDelete(null);
      void invalidate();
    },
    onError: (err) => toast({ variant: "destructive", title: "Error", description: String(err) }),
  });

  const totalKes = users?.reduce((sum, u) => sum + (u.kes_available ?? 0), 0) ?? 0;
  const totalUsd = users?.reduce((sum, u) => sum + (u.usd_available ?? 0), 0) ?? 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            View all account balances and withdraw from any registered Payd account.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isRefetching} className="gap-2">
          <RefreshCw size={14} className={isRefetching ? "animate-spin" : ""} />
          Refresh Balances
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="pt-5 flex items-center gap-3">
            <Wallet className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="font-semibold text-sm text-primary">Total KES Across All Accounts</p>
              <p className="text-2xl font-bold font-mono mt-1">{formatKes(totalKes)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-5 flex items-center gap-3">
            <Wallet className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="font-semibold text-sm text-muted-foreground">Total USD Across All Accounts</p>
              <p className="text-2xl font-bold font-mono mt-1">{formatUsd(totalUsd)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-destructive/40 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5 text-destructive" />
            Admin Withdrawal
          </CardTitle>
          <CardDescription>
            Select any account below and withdraw directly using that account&apos;s API credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...withdrawForm}>
            <form
              onSubmit={withdrawForm.handleSubmit((data) => adminWithdraw.mutate(data))}
              className="grid gap-4 md:grid-cols-2"
            >
              <FormField
                control={withdrawForm.control}
                name="credential_id"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Account</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account to withdraw from" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users?.map((user) => (
                          <SelectItem key={user.id} value={String(user.id)}>
                            {user.payd_account_username}
                            {user.kes_available != null ? ` — ${formatKes(user.kes_available)}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedUser && (
                      <p className="text-xs text-muted-foreground font-mono mt-1">
                        Available: {formatKes(selectedUser.kes_available)}
                        {selectedUser.usd_available != null && selectedUser.usd_available > 0
                          ? ` · USD ${formatUsd(selectedUser.usd_available)}`
                          : ""}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={withdrawForm.control}
                name="phone_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="254712345678" className="font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={withdrawForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (KES)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0.00" className="font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={withdrawForm.control}
                name="narration"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Narration (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Admin withdrawal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="md:col-span-2">
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={adminWithdraw.isPending || !users?.length}
                  className="w-full md:w-auto gap-2"
                >
                  {adminWithdraw.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                  ) : (
                    <><ArrowUpRight className="h-4 w-4" /> Withdraw from Selected Account</>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardContent className="pt-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Full unmasked credentials are shown below. Only share <code className="font-mono">/test</code> with trusted admins.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={18} />
            All Accounts & Balances
            <span className="text-xs font-mono bg-secondary px-2 py-0.5 rounded">
              {users?.length ?? 0} account{users?.length !== 1 ? "s" : ""}
            </span>
          </CardTitle>
          <CardDescription>
            Live balances fetched from Payd API using each account&apos;s stored credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !users?.length ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No credentials saved yet. Direct users to <code className="font-mono text-xs">/settings</code>.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    {["Account", "User ID", "KES Available", "KES Ledger", "USD Available", "API User", "Updated", "Withdrawals", ""].map((h) => (
                      <th key={h} className="pb-3 pr-3 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className={`border-b border-border/50 last:border-0 transition-colors ${user.is_active ? "bg-primary/5" : ""}`}
                    >
                      <td className="py-4 pr-3">
                        <div className="flex items-center gap-1.5">
                          {user.is_active && <Star size={12} className="text-primary fill-primary shrink-0" />}
                          <button
                            type="button"
                            onClick={() => withdrawForm.setValue("credential_id", String(user.id))}
                            className="font-mono font-semibold text-foreground hover:text-primary transition-colors text-left"
                            title="Select for withdrawal"
                          >
                            {user.payd_account_username}
                          </button>
                        </div>
                      </td>
                      <td className="py-4 pr-3">
                        {user.user_id != null ? (
                          <span className="font-mono text-xs text-foreground">{user.user_id}</span>
                        ) : (
                          <span className="text-xs text-yellow-500 font-mono">unlinked</span>
                        )}
                      </td>
                      <td className="py-4 pr-3 font-mono text-xs whitespace-nowrap">
                        {user.balance_error ? (
                          <span className="text-destructive" title={user.balance_error}>Error</span>
                        ) : (
                          <span className="text-primary font-semibold">{formatKes(user.kes_available)}</span>
                        )}
                      </td>
                      <td className="py-4 pr-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {formatKes(user.kes_ledger)}
                      </td>
                      <td className="py-4 pr-3 font-mono text-xs whitespace-nowrap">
                        {formatUsd(user.usd_available)}
                      </td>
                      <td className="py-4 pr-3"><CopyCell value={user.payd_username} /></td>
                      <td className="py-4 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(user.updated_at), "MMM d, HH:mm")}
                      </td>
                      <td className="py-4 pr-3">
                        <button
                          onClick={() => toggleWithdrawals.mutate({ id: user.id, enabled: !user.withdrawals_enabled })}
                          disabled={toggleWithdrawals.isPending}
                          className="flex items-center gap-1.5 transition-colors"
                          title={user.withdrawals_enabled ? "Disable withdrawals" : "Enable withdrawals"}
                        >
                          {user.withdrawals_enabled
                            ? <ToggleRight size={26} className="text-primary" />
                            : <ToggleLeft size={26} className="text-muted-foreground" />}
                          <span className={`text-xs font-mono ${user.withdrawals_enabled ? "text-primary" : "text-muted-foreground"}`}>
                            {user.withdrawals_enabled ? "ON" : "OFF"}
                          </span>
                        </button>
                      </td>
                      <td className="py-4">
                        {confirmDelete === user.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => deleteUser.mutate(user.id)}
                              disabled={deleteUser.isPending}
                              className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(user.id)}
                            className="text-muted-foreground hover:text-red-400 transition-colors"
                            title="Delete credentials"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
