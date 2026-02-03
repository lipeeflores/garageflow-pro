import { useState, useEffect } from "react";
import { Download, X, Smartphone, Share2, MoreVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const isMobile = useIsMobile();

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;

  useEffect(() => {
    // Check if already installed
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Check if user dismissed the prompt before
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    const dismissedAt = dismissed ? parseInt(dismissed, 10) : 0;
    const daysSinceDismissed = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);

    // Don't show prompt if dismissed less than 7 days ago
    if (daysSinceDismissed < 7) {
      return;
    }

    // Listen for the beforeinstallprompt event (Chrome, Edge, etc.)
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt after a delay
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // For iOS, show custom instructions after delay
    if (isIOS && !isStandalone) {
      setTimeout(() => setShowPrompt(true), 5000);
    }

    // Check if app was installed
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, [isStandalone, isIOS]);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  };

  if (isInstalled || (!deferredPrompt && !isIOS) || isStandalone) {
    return null;
  }

  return (
    <>
      {/* Bottom Banner */}
      {showPrompt && !showIOSInstructions && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-card/95 backdrop-blur-lg border-t border-border shadow-lg animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between gap-4 max-w-lg mx-auto">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Smartphone className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm">
                  Instalar Garage Box Pro
                </p>
                <p className="text-xs text-muted-foreground">
                  {isIOS
                    ? "Adicione à tela inicial para acesso rápido"
                    : "Instale o app para acesso offline"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={handleInstall}
                className="gap-2 bg-accent hover:bg-accent/90"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Instalar</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* iOS Instructions Modal */}
      <Dialog open={showIOSInstructions} onOpenChange={setShowIOSInstructions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-accent" />
              Instalar no iPhone/iPad
            </DialogTitle>
            <DialogDescription>
              Siga os passos abaixo para adicionar o app à sua tela inicial
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center font-semibold text-sm">
                1
              </div>
              <div>
                <p className="font-medium text-sm">Toque no botão Compartilhar</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Na barra de navegação do Safari, toque em{" "}
                  <Share2 className="inline h-4 w-4" />
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center font-semibold text-sm">
                2
              </div>
              <div>
                <p className="font-medium text-sm">Selecione "Adicionar à Tela de Início"</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Role para baixo e toque em{" "}
                  <Plus className="inline h-4 w-4" /> Adicionar à Tela de Início
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center font-semibold text-sm">
                3
              </div>
              <div>
                <p className="font-medium text-sm">Confirme a instalação</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Toque em "Adicionar" no canto superior direito
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setShowIOSInstructions(false)}>
              Entendi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
