import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield, RefreshCw, AlertTriangle, Copy,
  ToggleLeft, ToggleRight, Users, Star, Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface UserRow {
  id: number;
  payd_account_username: string;
  payd_username: string;
  payd_password: string;
  payd_api_secret: string | null;
  is_active: boolean;
  withdrawals_enabled: boolean;
  created_at: string;
  updated_at: string;
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

  const setActive = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/test/users/${id}/active`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to set active");
    },
    onSuccess: (_, id) => {
      toast({ title: "Active Credentials Updated", description: `Credentials #${id} are now used for balance and deposits.` });
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
        description: `User #${id} withdrawal access updated.`,
      });
      void invalidate();
    },
    onError: (err) => toast({ variant: "destructive", title: "Error", description: String(err) }),
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

  const activeUser = users?.find((u) => u.is_active);

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage credentials and control system access.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isRefetching} className="gap-2">
          <RefreshCw size={14} className={isRefetching ? "animate-spin" : ""} />
          Refresh
        </Button>
      </header>

      {/* Active credentials summary */}
      {activeUser ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="pt-5 flex items-center gap-3">
            <Star className="h-5 w-5 text-primary shrink-0 fill-primary" />
            <div>
              <p className="font-semibold text-sm text-primary">Active System Credentials</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Balance checks and deposits use{" "}
                <span className="font-mono font-bold text-foreground">{activeUser.payd_account_username}</span>
                {activeUser.withdrawals_enabled && (
                  <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-mono">WITHDRAWALS ON</span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-yellow-500/40 bg-yellow-500/5">
          <CardContent className="pt-5 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
            <p className="text-sm text-muted-foreground">
              <span className="text-yellow-500 font-semibold">No active credentials set.</span>{" "}
              Use the <Star size={12} className="inline" /> button below to activate a user's credentials.
            </p>
          </CardContent>
        </Card>
      )}

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
            Registered Credentials
            <span className="text-xs font-mono bg-secondary px-2 py-0.5 rounded">
              {users?.length ?? 0} user{users?.length !== 1 ? "s" : ""}
            </span>
          </CardTitle>
          <CardDescription>
            <span className="inline-flex items-center gap-1"><Star size={12} className="text-primary" /></span> = system-wide active (balance + deposits).
            Withdrawals toggle = that user can withdraw using their own credentials.
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
                    {["Account", "API Username", "API Password", "API Secret", "Updated", "Active", "Withdrawals", ""].map((h) => (
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
                          <span className="font-mono font-semibold text-foreground">{user.payd_account_username}</span>
                        </div>
                      </td>
                      <td className="py-4 pr-3"><CopyCell value={user.payd_username} /></td>
                      <td className="py-4 pr-3"><CopyCell value={user.payd_password} /></td>
                      <td className="py-4 pr-3"><CopyCell value={user.payd_api_secret} /></td>
                      <td className="py-4 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(user.updated_at), "MMM d, HH:mm")}
                      </td>

                      {/* Set Active */}
                      <td className="py-4 pr-3">
                        {user.is_active ? (
                          <span className="text-xs font-mono text-primary bg-primary/15 px-2 py-0.5 rounded">ACTIVE</span>
                        ) : (
                          <button
                            onClick={() => setActive.mutate(user.id)}
                            disabled={setActive.isPending}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors border border-border hover:border-primary/50 px-2 py-0.5 rounded"
                            title="Set as active system credentials"
                          >
                            <Star size={11} /> Set
                          </button>
                        )}
                      </td>

                      {/* Withdrawals toggle */}
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

                      {/* Delete */}
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
