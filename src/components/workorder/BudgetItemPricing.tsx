import { useState } from "react";
import { DollarSign, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpsertItemPricing, WorkOrderItem } from "@/hooks/useWorkOrderItems";

interface BudgetItemPricingProps {
  item: WorkOrderItem;
  workOrderId: string;
}

export function BudgetItemPricing({ item, workOrderId }: BudgetItemPricingProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [unitPrice, setUnitPrice] = useState(
    item.pricing?.unit_price ? Number(item.pricing.unit_price).toString() : ""
  );
  const [unitCost, setUnitCost] = useState(
    item.pricing?.unit_cost ? Number(item.pricing.unit_cost).toString() : ""
  );

  const upsertPricing = useUpsertItemPricing();

  const handleSave = async () => {
    const price = parseFloat(unitPrice);
    if (isNaN(price) || price <= 0) return;

    await upsertPricing.mutateAsync({
      itemId: item.id,
      workOrderId,
      unitPrice: price,
      quantity: item.quantity,
      unitCost: unitCost ? parseFloat(unitCost) : undefined,
    });
    
    setIsEditing(false);
  };

  const handleCancel = () => {
    setUnitPrice(item.pricing?.unit_price ? Number(item.pricing.unit_price).toString() : "");
    setUnitCost(item.pricing?.unit_cost ? Number(item.pricing.unit_cost).toString() : "");
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1 text-xs"
        onClick={() => setIsEditing(true)}
      >
        <DollarSign className="h-3 w-3" />
        {item.pricing?.unit_price ? "Editar" : "Precificar"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col gap-1">
        <Input
          type="number"
          placeholder="Preço unit."
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          className="h-7 w-24 text-xs"
          min={0}
          step={0.01}
        />
        <Input
          type="number"
          placeholder="Custo (opc.)"
          value={unitCost}
          onChange={(e) => setUnitCost(e.target.value)}
          className="h-7 w-24 text-xs"
          min={0}
          step={0.01}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-success"
          onClick={handleSave}
          disabled={upsertPricing.isPending}
        >
          {upsertPricing.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive"
          onClick={handleCancel}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
