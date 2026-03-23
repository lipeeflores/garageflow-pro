import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Circle, Printer, Wrench, Package, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useWorkOrderItems, type WorkOrderItem } from "@/hooks/useWorkOrderItems";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ExecutionChecklistProps {
  workOrderId: string;
  vehiclePlate?: string;
  vehicleInfo?: string;
  onAllChecked?: (allChecked: boolean) => void;
  readOnly?: boolean;
}

export function ExecutionChecklist({ 
  workOrderId, 
  vehiclePlate, 
  vehicleInfo,
  onAllChecked,
  readOnly = false,
}: ExecutionChecklistProps) {
  const { data: items, isLoading } = useWorkOrderItems(workOrderId);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const checklistRef = useRef<HTMLDivElement>(null);

  // Load checked state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`checklist-${workOrderId}`);
    if (saved) {
      try {
        setCheckedItems(new Set(JSON.parse(saved)));
      } catch {}
    }
  }, [workOrderId]);

  // Save and notify parent
  useEffect(() => {
    localStorage.setItem(`checklist-${workOrderId}`, JSON.stringify([...checkedItems]));
    if (items && items.length > 0) {
      onAllChecked?.(checkedItems.size >= items.length);
    }
  }, [checkedItems, items, onAllChecked, workOrderId]);

  const toggleItem = (itemId: string) => {
    if (readOnly) return;
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handlePrint = () => {
    const printContent = checklistRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const services = items?.filter(i => i.item_type === 'SERVICE') || [];
    const parts = items?.filter(i => i.item_type === 'PART') || [];

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Checklist - ${vehiclePlate || 'OS'}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          h2 { font-size: 14px; margin: 16px 0 8px; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
          .subtitle { color: #64748b; font-size: 12px; margin-bottom: 16px; }
          .item { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
          .checkbox { width: 16px; height: 16px; border: 2px solid #94a3b8; border-radius: 3px; flex-shrink: 0; }
          .checkbox.checked { background: #22c55e; border-color: #22c55e; }
          .label { font-size: 13px; }
          .qty { color: #64748b; font-size: 11px; }
          .footer { margin-top: 30px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          @media print { body { padding: 10mm; } }
        </style>
      </head>
      <body>
        <h1>Checklist de Execução</h1>
        <div class="subtitle">${vehiclePlate || ''} ${vehicleInfo ? '• ' + vehicleInfo : ''}</div>
        
        ${services.length > 0 ? `
          <h2>🔧 Serviços</h2>
          ${services.map(s => `
            <div class="item">
              <div class="checkbox ${checkedItems.has(s.id) ? 'checked' : ''}"></div>
              <span class="label">${s.description}</span>
            </div>
          `).join('')}
        ` : ''}
        
        ${parts.length > 0 ? `
          <h2>📦 Peças</h2>
          ${parts.map(p => `
            <div class="item">
              <div class="checkbox ${checkedItems.has(p.id) ? 'checked' : ''}"></div>
              <span class="label">${p.description}</span>
              ${p.quantity > 1 ? `<span class="qty">x${p.quantity}</span>` : ''}
            </div>
          `).join('')}
        ` : ''}
        
        <div class="footer">
          MA Mecânica Multimarcas • Impresso em ${new Date().toLocaleString('pt-BR')}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const services = items?.filter(i => i.item_type === 'SERVICE') || [];
  const parts = items?.filter(i => i.item_type === 'PART') || [];
  const allChecked = items ? checkedItems.size >= items.length : false;
  const progress = items && items.length > 0 ? Math.round((checkedItems.size / items.length) * 100) : 0;

  return (
    <Card ref={checklistRef}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Checklist de Execução
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={allChecked ? "default" : "secondary"} className={allChecked ? "bg-success" : ""}>
              {checkedItems.size}/{items?.length || 0} ({progress}%)
            </Badge>
            <Button variant="outline" size="sm" className="gap-1" onClick={handlePrint}>
              <Printer className="h-3 w-3" />
              Imprimir
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {services.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Serviços</span>
            </div>
            <div className="space-y-1">
              {services.map(item => (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  disabled={readOnly}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    checkedItems.has(item.id) 
                      ? 'bg-success/10 text-success line-through' 
                      : 'bg-muted/50 hover:bg-muted'
                  } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {checkedItems.has(item.id) ? (
                    <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="text-sm">{item.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {parts.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-accent" />
              <span className="font-medium text-sm">Peças</span>
            </div>
            <div className="space-y-1">
              {parts.map(item => (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  disabled={readOnly}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    checkedItems.has(item.id) 
                      ? 'bg-success/10 text-success line-through' 
                      : 'bg-muted/50 hover:bg-muted'
                  } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {checkedItems.has(item.id) ? (
                    <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="text-sm">
                    {item.description}
                    {item.quantity > 1 && (
                      <Badge variant="secondary" className="ml-2 text-xs">x{item.quantity}</Badge>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {(!items || items.length === 0) && (
          <p className="text-center text-sm text-muted-foreground py-4">Nenhum item cadastrado</p>
        )}
      </CardContent>
    </Card>
  );
}
