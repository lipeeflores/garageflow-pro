import { useState } from "react";
import { Share2, Copy, MessageCircle, Check, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface ShareBudgetButtonProps {
  workOrderId: string;
  customerPhone?: string;
  customerName?: string;
  vehiclePlate?: string;
  totalAmount?: number;
}

export function ShareBudgetButton({
  workOrderId,
  customerPhone,
  customerName,
  vehiclePlate,
  totalAmount,
}: ShareBudgetButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Generate the approval link
  const token = workOrderId.slice(0, 8).toUpperCase();
  const baseUrl = window.location.origin;
  const approvalLink = `${baseUrl}/orcamento/${workOrderId}?token=${token}`;

  // Generate WhatsApp message
  const whatsappMessage = encodeURIComponent(
    `Olá${customerName ? ` ${customerName.split(' ')[0]}` : ''}! 🚗\n\n` +
    `Seu orçamento para o veículo *${vehiclePlate || 'N/A'}* está pronto.\n\n` +
    (totalAmount ? `💰 *Valor Total: R$ ${totalAmount.toFixed(2)}*\n\n` : '') +
    `Clique no link abaixo para visualizar os detalhes e aprovar:\n` +
    `${approvalLink}\n\n` +
    `Qualquer dúvida, estamos à disposição!`
  );

  // Clean phone number for WhatsApp
  const cleanPhone = customerPhone?.replace(/\D/g, '') || '';
  const whatsappLink = `https://wa.me/55${cleanPhone}?text=${whatsappMessage}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(approvalLink);
      setCopied(true);
      toast({
        title: "Link copiado!",
        description: "O link de aprovação foi copiado para a área de transferência.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível copiar o link.",
        variant: "destructive",
      });
    }
  };

  const handleWhatsApp = () => {
    window.open(whatsappLink, '_blank');
  };

  const handlePreview = () => {
    window.open(approvalLink, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full gap-2">
          <Share2 className="h-4 w-4" />
          Enviar p/ Cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compartilhar Orçamento</DialogTitle>
          <DialogDescription>
            Envie o link de aprovação para o cliente via WhatsApp ou copie o link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Link preview */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Link de Aprovação</label>
            <div className="flex gap-2">
              <Input 
                value={approvalLink} 
                readOnly 
                className="text-xs"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="grid gap-2">
            {customerPhone && (
              <Button
                className="w-full gap-2 bg-[#25D366] hover:bg-[#25D366]/90"
                onClick={handleWhatsApp}
              >
                <MessageCircle className="h-4 w-4" />
                Enviar via WhatsApp
              </Button>
            )}
            
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handlePreview}
            >
              <ExternalLink className="h-4 w-4" />
              Visualizar Página
            </Button>
          </div>

          {!customerPhone && (
            <p className="text-xs text-muted-foreground text-center">
              O cliente não possui telefone cadastrado. 
              Copie o link e envie manualmente.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
