import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetCredentialStatus, getGetCredentialStatusQueryKey } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";

// localStorage flag so the first-run prompt only ever appears once per browser.
const SEEN_KEY = "payd_credentials_prompt_seen";

/**
 * Shows a one-time modal nudging the user to configure their Payd API
 * credentials when none are set yet. After it is shown (or dismissed) once,
 * a localStorage flag keeps it from appearing again.
 */
export default function CredentialsPrompt() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const { data: status, isLoading } = useGetCredentialStatus({
    query: { queryKey: getGetCredentialStatusQueryKey() },
  });

  useEffect(() => {
    if (isLoading || !status) return;

    let alreadySeen = false;
    try {
      alreadySeen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      // localStorage unavailable (e.g. privacy mode) — treat as not seen.
    }

    if (!status.is_configured && !alreadySeen) {
      setOpen(true);
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {
        // Ignore write failures; the prompt simply may appear again next load.
      }
    }
  }, [status, isLoading]);

  const goToSettings = () => {
    setOpen(false);
    setLocation("/settings");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Set up your API credentials
          </DialogTitle>
          <DialogDescription>
            You haven&apos;t set up your Payd API credentials yet. Add them to start
            viewing balances and making payments. This reminder only appears once.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Later
          </Button>
          <Button onClick={goToSettings}>Set up credentials</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
