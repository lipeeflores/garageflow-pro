import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  DollarSign, 
  Plus, 
  Trash2, 
  Loader2,
  Package,
  Wrench
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  useWorkOrderItems,
  useCreateWorkOrderItem,
  useDeleteWorkOrderItem,
} from "@/hooks/useWorkOrderItems";
import { useAuth } from "@/contexts/AuthContext";
import { BudgetItemPricing } from "./BudgetItemPricing";

const itemSchema = z.object({
  item_type: z.enum(["SERVICE", "PART"]),
  description: z.string().min(3, "Descrição obrigatória"),
  quantity: z.number().min(1, "Quantidade mínima é 1"),
  part_code: z.string().optional(),
});

type ItemFormData = z.infer<typeof itemSchema>;

interface WorkOrderBudgetProps {
  workOrderId: string;
  canEdit: boolean;
  currentStep?: string;
}

export function WorkOrderBudget({ workOrderId, canEdit, currentStep }: WorkOrderBudgetProps) {
  const [showForm, setShowForm] = useState(false);
  const { isAdminOrManager } = useAuth();
  
  const { data: items, isLoading } = useWorkOrderItems(workOrderId);
  const createItem = useCreateWorkOrderItem();
  const deleteItem = useDeleteWorkOrderItem();
  
  const form = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      item_type: "SERVICE",
      description: "",
      quantity: 1,
      part_code: "",
    },
  });

  const onSubmit = async (data: ItemFormData) => {
    try {
      await createItem.mutateAsync({
        work_order_id: workOrderId,
        item_type: data.item_type,
        description: data.description,
        quantity: data.quantity,
        part_code: data.part_code || null,
      });

      form.reset();
      setShowForm(false);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm("Deseja remover este item?")) return;
    await deleteItem.mutateAsync({ id: itemId, workOrderId });
  };

  // Calculate totals (only for admin/manager)
  const totals = items?.reduce((acc, item) => {
    const price = item.pricing?.total_price ?? 0;
    if (item.item_type === "SERVICE") {
      acc.services += Number(price);
    } else {
      acc.parts += Number(price);
    }
    return acc;
  }, { services: 0, parts: 0 });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add item button */}
      {canEdit && !showForm && (
        <Button 
          onClick={() => setShowForm(true)}
          className="w-full gap-2"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          Adicionar Item ao Orçamento
        </Button>
      )}

      {/* New item form */}
      {showForm && (
        <Card className="border-primary/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Novo Item
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="item_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="SERVICE">
                              <div className="flex items-center gap-2">
                                <Wrench className="h-4 w-4" />
                                Serviço
                              </div>
                            </SelectItem>
                            <SelectItem value="PART">
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                Peça
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Troca de óleo, Filtro de ar..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("item_type") === "PART" && (
                  <FormField
                    control={form.control}
                    name="part_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código da Peça</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Código opcional"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => {
                      form.reset();
                      setShowForm(false);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit"
                    disabled={createItem.isPending}
                  >
                    {createItem.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Adicionar Item"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Items list */}
      {items && items.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  {isAdminOrManager && (
                    <>
                      <TableHead className="text-right">Unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </>
                  )}
                  {canEdit && isAdminOrManager && (
                    <TableHead className="w-10"></TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge 
                        variant="secondary"
                        className={
                          item.item_type === "SERVICE" 
                            ? "bg-primary/10 text-primary" 
                            : "bg-accent/10 text-accent"
                        }
                      >
                        {item.item_type === "SERVICE" ? (
                          <><Wrench className="h-3 w-3 mr-1" /> Serviço</>
                        ) : (
                          <><Package className="h-3 w-3 mr-1" /> Peça</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.description}</p>
                        {item.part_code && (
                          <p className="text-xs text-muted-foreground">
                            Cód: {item.part_code}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    {isAdminOrManager && (
                      <>
                        <TableCell className="text-right">
                          {item.pricing?.unit_price ? (
                            `R$ ${Number(item.pricing.unit_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.pricing?.total_price ? (
                            `R$ ${Number(item.pricing.total_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </>
                    )}
                    {canEdit && isAdminOrManager && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <BudgetItemPricing item={item} workOrderId={workOrderId} />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Totals */}
            {isAdminOrManager && totals && (
              <div className="border-t p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Serviços:</span>
                  <span>R$ {totals.services.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Peças:</span>
                  <span>R$ {totals.parts.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total:</span>
                  <span className="text-success">
                    R$ {(totals.services + totals.parts).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : !showForm && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <DollarSign className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhum item no orçamento
          </p>
        </div>
      )}
    </div>
  );
}
