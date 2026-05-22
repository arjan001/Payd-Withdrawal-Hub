import { useState } from "react";
import { useGetTransactions, getGetTransactionsQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownLeft, ArrowUpRight, Search, SlidersHorizontal, Activity } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Transactions() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: txData, isLoading } = useGetTransactions(
    { page, limit },
    { query: { queryKey: getGetTransactionsQueryKey({ page, limit }) } }
  );

  const formatCurrency = (amount: number, currency: string = "KES") => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Comprehensive history of all your money movements.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search reference..." 
              className="w-[200px] pl-9 bg-card"
            />
          </div>
          <Button variant="outline" size="icon">
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </header>

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
                  No transactions found.
                </TableCell>
              </TableRow>
            ) : (
              txData?.transactions.map((tx) => (
                <TableRow key={tx.id} className="hover:bg-muted/50 cursor-pointer transition-colors">
                  <TableCell>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      tx.type === 'payin' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {tx.type === 'payin' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{tx.reference || tx.id.slice(0, 8)}</TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(tx.created_at), 'MMM dd, yyyy HH:mm:ss')}
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    <span className="text-muted-foreground mr-2 text-xs">{tx.channel}</span>
                    {tx.phone_number || '-'}
                  </TableCell>
                  <TableCell>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm inline-block font-mono ${
                      tx.status === 'completed' || tx.status === 'success' ? 'bg-primary/20 text-primary' : 
                      tx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' : 
                      'bg-destructive/20 text-destructive'
                    }`}>
                      {tx.status}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right font-mono font-medium ${
                    tx.type === 'payin' ? 'text-primary' : 'text-foreground'
                  }`}>
                    {tx.type === 'payin' ? '+' : '-'}{formatCurrency(tx.amount, tx.currency)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="p-4 border-t border-border flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{txData?.transactions.length || 0}</span> of <span className="font-medium text-foreground">{txData?.total || 0}</span> transactions
          </p>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page === 1 || isLoading}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              disabled={!txData || txData.transactions.length < limit || isLoading}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
