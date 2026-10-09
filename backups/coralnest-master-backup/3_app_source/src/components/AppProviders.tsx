import { TooltipProvider } from "./ui/tooltip";

/**
 * App-level providers for the public catalog shell. The app is fully public
 * (no accounts), so there is no auth provider or user bootstrap wiring here.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return <TooltipProvider delayDuration={400}>{children}</TooltipProvider>;
}
