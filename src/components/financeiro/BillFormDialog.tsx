import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useCreateBill } from "@/hooks/useBills";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: "FIXA" | "FLUTUANTE";
}

export function BillFormDialog({ open, onOpenChange, defaultCategory }: Props) {
  const createBill = useCreateBill();
  const [form, setForm] = useState({
    description: "",
    amount: "",
    category: defaultCategory || ("FIXA" as "FIXA" | "FLUTUANTE"),
    due_date: new Date().toISOString().split("T")[0],
    supplier: "",
    notes: "",
    is_recurring: false,
    recurrence_day: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.amount || !form.due_date) return;

    createBill.mutate(
      {
        description: form.description,
        amount: parseFloat(form.amount),
        category: form.category,
        due_date: form.due_date,
        supplier: form.supplier || null,
        notes: form.notes || null,
        is_recurring: form.is_recurring,
        recurrence_day: form.recurrence_day ? parseInt(form.recurrence_day) : null,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setForm({
            description: "",
            amount: "",
            category: defaultCategory || "FIXA",
            due_date: new Date().toISOString().split("T")[0],
            supplier: "",
            notes: "",
            is_recurring: false,
            recurrence_day: "",
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Conta a Pagar</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex: Aluguel, Peças motor..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0,00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v as "FIXA" | "FLUTUANTE" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXA">Fixa</SelectItem>
                  <SelectItem value="FLUTUANTE">Flutuante</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vencimento *</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Input
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                placeholder="Nome do fornecedor"
              />
            </div>
          </div>

          {form.category === "FIXA" && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label>Conta recorrente</Label>
                <p className="text-xs text-muted-foreground">Repete todo mês</p>
              </div>
              <Switch
                checked={form.is_recurring}
                onCheckedChange={(v) => setForm({ ...form, is_recurring: v })}
              />
            </div>
          )}

          {form.is_recurring && form.category === "FIXA" && (
            <div className="space-y-2">
              <Label>Dia do vencimento mensal</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={form.recurrence_day}
                onChange={(e) => setForm({ ...form, recurrence_day: e.target.value })}
                placeholder="Ex: 10"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notas adicionais..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createBill.isPending}>
              {createBill.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
