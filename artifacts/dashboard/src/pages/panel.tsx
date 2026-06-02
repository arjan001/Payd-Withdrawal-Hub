import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, RefreshCw, AlertTriangle, Copy, ToggleLeft, ToggleRight, Users } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface UserRow {
  id: number;
  payd_account_username: string;
  payd_username: string;
  payd_password: string;
  payd_api_secret: string | null;
  withdrawals_enabled: boolean;
  created_at: string;
  updated_at: string;
}

function CopyCell({ value }: { value: string | null }) {
  const { toast } = useToast();
  if (!value) return <span className="text-muted-foreground italic text-xs">—</span>;
  return (
    <div className="flex items-center gap-1.5 group">
      <code className="font-mono text-xs break-all">{value}</code>
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
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const { data: users, isLoading, refetch, isRefetching } = useQuery<UserRow[]>({
    queryKey: ["test-users"],
    queryFn: async () => {
      const res = await fetch("/api/test/users");
      if (!res.ok) throw new Error("Failed to load users");
      return res.json() as Promise<UserRow[]>;
    },
  });

  const toggleWithdrawals = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      const res = await fetch(`/api/test/users/${id}/withdrawals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawals_enabled: enabled }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onMutate: ({ id }) => setLoadingId(id),
    onSuccess: (_data, { id, enabled }) => {
      toast({
        title: enabled ? "Withdrawals Enabled" : "Withdrawals Disabled",
        description: `Updated for user #${id}`,
      });
      void queryClient.invalidateQueries({ queryKey: ["test-users"] });
    },
    onError: (err) => toast({ variant: "destructive", title: "Error", description: String(err) }),
    onSettled: () => setLoadingId(null),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage all registered users and their credentials.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isRefetching}
          className="gap-2"
        >
          <RefreshCw size={14} className={isRefetching ? "animate-spin" : ""} />
          Refresh
        </Button>
      </header>

      <Card className="border-yellow-500/40 bg-yellow-500/5">
        <CardContent className="pt-5 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            This page shows{" "}
            <span className="text-foreground font-medium">full unmasked credentials</span> for all
            users. Only share this URL (<code className="font-mono text-xs">/test</code>) with
            trusted administrators.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={18} />
            Registered Users
            <span className="text-xs font-mono bg-secondary px-2 py-0.5 rounded">
              {users?.length ?? 0} user{users?.length !== 1 ? "s" : ""}
            </span>
          </CardTitle>
          <CardDescription>
            Toggle withdrawals per user. When enabled, that user can use Withdraw, Merchant, and P2P
            features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !users?.length ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No users have set up credentials yet. Direct users to{" "}
              <code className="font-mono text-xs">/settings</code> to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-3 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Account</th>
                    <th className="pb-3 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">API Username</th>
                    <th className="pb-3 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">API Password</th>
                    <th className="pb-3 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">API Secret</th>
                    <th className="pb-3 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Updated</th>
                    <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Withdrawals</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-border/50 last:border-0">
                      <td className="py-4 pr-4">
                        <span className="font-mono font-semibold text-foreground">
                          {user.payd_account_username}
                        </span>
                      </td>
                      <td className="py-4 pr-4">
                        <CopyCell value={user.payd_username} />
                      </td>
                      <td className="py-4 pr-4">
                        <CopyCell value={user.payd_password} />
                      </td>
                      <td className="py-4 pr-4">
                        <CopyCell value={user.payd_api_secret} />
                      </td>
                      <td className="py-4 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(user.updated_at), "MMM d, HH:mm")}
                      </td>
                      <td className="py-4">
                        <button
                          onClick={() =>
                            toggleWithdrawals.mutate({
                              id: user.id,
                              enabled: !user.withdrawals_enabled,
                            })
                          }
                          disabled={loadingId === user.id}
                          className="flex items-center gap-2 transition-colors"
                          title={user.withdrawals_enabled ? "Disable withdrawals" : "Enable withdrawals"}
                        >
                          {user.withdrawals_enabled ? (
                            <ToggleRight size={28} className="text-primary" />
                          ) : (
                            <ToggleLeft size={28} className="text-muted-foreground" />
                          )}
                          <span
                            className={`text-xs font-mono ${user.withdrawals_enabled ? "text-primary" : "text-muted-foreground"}`}
                          >
                            {user.withdrawals_enabled ? "ON" : "OFF"}
                          </span>
                        </button>
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
