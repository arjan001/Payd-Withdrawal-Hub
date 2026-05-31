import { useState } from "react";
import { useGetTransactions, getGetTransactionsQueryKey, useGetTransactionStatus } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownLeft, ArrowUpRight, Search, Activity, RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>;
  const s = status.toLowerCase();
  if (s === "success" || s === "completed") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-mono bg-primary/20 text-primary">
        <CheckCircle2 size={10} /> {status}
      </span>
    );
  }
  if (s === "pending" || s === "processing") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-mono bg-yellow-500/20 text-yellow-500">
        <Clock size={10} /> {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-mono bg-destructive/20 text-destructive">
      <XCircle size={10} /> {status}
    </span>
  );
}

function TransactionStatusCard({ reference }: { reference: string }) {
  const { data, isLoading, error, refetch } = useGetTransactionStatus(reference);

  const formatCurrency = (amount: number, currency = "KES") =>
    new Intl.NumberFormat("en-KE", { style: "currency", currency }).format(amount);

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 text-sm text-destructive flex items-center gap-2">
        <XCircle size={14} />
        {(error as Error)?.message || "Transaction not found"}
        <Button variant="ghost" size="sm" onClick={() => void refetch()} className="ml-auto h-7 text-xs gap-1">
          <RefreshCw size={12} /> Retry
        </Button>
      </div>
    );
  }

  const d = data.transaction_details;

  return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <StatusBadge status={d?.status} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Amount</p>
          <p className="font-mono font-semibold">{formatCurrency(data.amount, data.currency)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Type</p>
          <p className="capitalize">{data.type}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Channel</p>
          <p className="capitalize">{d?.channel ?? "—"}</p>
        </div>
        {d?.payer && (
          <div>
            <p className="text-xs text-muted-foreground">Payer</p>
            <p className="font-mono">{d.payer}</p>
          </div>
        )}
        {d?.receiver && (
          <div>
            <p className="text-xs text-muted-foreground">Receiver</p>
            <p>{d.receiver}</p>
          </div>
        )}
        {d?.phone_number && (
          <div>
            <p className="text-xs text-muted-foreground">Phone</p>
            <p className="font-mono">{d.phone_number}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground">Balance After</p>
          <p className="font-mono">{formatCurrency(data.balance, data.currency)}</p>
        </div>
        {d?.reason && (
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Reason</p>
            <p className="text-sm">{d.reason}</p>
          </div>
        )}
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">Created</p>
          <p className="font-mono text-xs">{format(new Date(data.created_at), "MMM dd, yyyy HH:mm:ss")}</p>
        </div>
      </div>
    </div>
  );
}

export default function Transactions() {
  const [page, setPage] = useState(1);
  const [statusRef, setStatusRef] = useState("");
  const [lookupRef, setLookupRef] = useState<string | null>(null);
  const limit = 20;

  const { data: txData, isLoading } = useGetTransactions(
    { page, limit },
    { query: { queryKey: getGetTransactionsQueryKey({ page, limit }) } }
  );

  const formatCurrency = (amount: number, currency: string = "KES") =>
    new Intl.NumberFormat("en-KE", { style: "currency", currency }).format(amount);

  const handleLookup = () => {
    const ref = statusRef.trim();
    if (ref) setLookupRef(ref);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          View transaction history and look up any transaction by reference.
        </p>
      </header>

      {/* Transaction Status Lookup */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search size={16} className="text-primary" />
            Transaction Status Lookup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Enter reference e.g. 9BD103350408eR"
              className="font-mono flex-1"
              value={statusRef}
              onChange={(e) => setStatusRef(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleLookup(); }}
            />
            <Button onClick={handleLookup} disabled={!statusRef.trim()} className="gap-2">
              <Search size={14} />
              Check Status
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Reference suffixes: <code className="font-mono">eR</code> = payin · <code className="font-mono">eW</code> = withdrawal · <code className="font-mono">eS</code> = P2P transfer · <code className="font-mono">eT</code> = top-up
          </p>

          {lookupRef && (
            <div className="border border-border rounded-md overflow-hidden mt-2">
              <div className="px-4 py-2 bg-secondary/40 border-b border-border flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground">{lookupRef}</span>
                <button
                  onClick={() => setLookupRef(null)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              </div>
              <TransactionStatusCard reference={lookupRef} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction List */}
      <Card className="border-border bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Channel/Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(10).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : txData?.transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No transactions yet.</p>
                  <p className="text-xs mt-1">Use the lookup above to check a specific reference.</p>
                </TableCell>
              </TableRow>
            ) : (
              txData?.transactions.map((tx) => (
                <TableRow
                  key={tx.id}
                  className="hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => {
                    if (tx.reference) {
                      setStatusRef(tx.reference);
                      setLookupRef(tx.reference);
                    }
                  }}
                >
                  <TableCell>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      tx.type === "payin" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                    }`}>
                      {tx.type === "payin" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{tx.reference || tx.id.slice(0, 8)}</TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(tx.created_at), "MMM dd, yyyy HH:mm:ss")}
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    <span className="text-muted-foreground mr-2 text-xs">{tx.channel}</span>
                    {tx.phone_number || "—"}
                  </TableCell>
                  <TableCell><StatusBadge status={tx.status} /></TableCell>
                  <TableCell className={`text-right font-mono font-medium ${
                    tx.type === "payin" ? "text-primary" : "text-foreground"
                  }`}>
                    {tx.type === "payin" ? "+" : "−"}{formatCurrency(tx.amount, tx.currency)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="p-4 border-t border-border flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{txData?.transactions.length || 0}</span> of{" "}
            <span className="font-medium text-foreground">{txData?.total || 0}</span> transactions
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1 || isLoading} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={!txData || txData.transactions.length < limit || isLoading} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
