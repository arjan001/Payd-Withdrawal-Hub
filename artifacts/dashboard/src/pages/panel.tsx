import { useGetPanelCredentials, getGetPanelCredentialsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, RefreshCw, Copy, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

function CredRow({ label, value }: { label: string; value: string | null | undefined }) {
  const { toast } = useToast();

  const handleCopy = () => {
    if (value) {
      void navigator.clipboard.writeText(value);
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
    }
  };

  return (
    <div className="py-3 border-b border-border last:border-0">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center justify-between gap-2">
        {value ? (
          <>
            <code className="font-mono text-sm text-foreground break-all flex-1">{value}</code>
            <button
              onClick={handleCopy}
              className="text-muted-foreground hover:text-foreground shrink-0 ml-2"
              title="Copy"
            >
              <Copy size={14} />
            </button>
          </>
        ) : (
          <span className="text-muted-foreground text-sm italic">Not set</span>
        )}
      </div>
    </div>
  );
}

export default function Panel() {
  const { data, isLoading, refetch, isRefetching } = useGetPanelCredentials({
    query: { queryKey: getGetPanelCredentialsQueryKey() }
  });

  const isConfigured = !!(data?.payd_username && data?.payd_password && data?.payd_account_username);

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            View all stored API credentials. Handle with care.
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
            This page displays <span className="text-foreground font-medium">unmasked credentials</span>. 
            Only share this URL with trusted administrators. Do not access from public networks.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Payd API Credentials
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-sm ${isConfigured ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}`}>
              {isLoading ? "..." : isConfigured ? "CONFIGURED" : "NOT SET"}
            </span>
          </CardTitle>
          <CardDescription>
            {data?.updated_at
              ? `Last updated: ${format(new Date(data.updated_at), "MMM dd, yyyy HH:mm:ss")}`
              : "No credentials saved yet. Go to Settings to add them."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div>
              <CredRow label="PAYD_ACCOUNT_USERNAME (Profile username)" value={data?.payd_account_username} />
              <CredRow label="PAYD_USERNAME (API Key Username)" value={data?.payd_username} />
              <CredRow label="PAYD_PASSWORD (API Key Password)" value={data?.payd_password} />
              <CredRow label="PAYD_API_SECRET" value={data?.payd_api_secret} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
