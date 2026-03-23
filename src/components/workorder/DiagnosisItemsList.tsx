import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Package, Wrench, Loader2, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useWorkOrderItems,
  useCreateWorkOrderItem,
  useDeleteWorkOrderItem,
} from "@/hooks/useWorkOrderItems";
import { useAuth } from "@/contexts/AuthContext";

const itemSchema = z.object({
  item_type: z.enum(["SERVICE", "PART"]),
  description: z.string().min(3, "Descrição obrigatória"),
  quantity: z.number().min(1, "Quantidade mínima é 1"),
  part_code: z.string().optional(),
});

type ItemFormData = z.infer<typeof itemSchema>;

interface DiagnosisItemsListProps {
  workOrderId: string;
  canEdit: boolean;
}

export function DiagnosisItemsList({ workOrderId, canEdit }: DiagnosisItemsListProps) {
  const [showForm, setShowForm] = useState(false);
  const { isAdminOrManager } = useAuth();

  const { data: items, isLoading } = useWorkOrderItems(workOrderId);
  const createItem = useCreateWorkOrderItem();
  const deleteItem = useDeleteWorkOrderItem();

  const form = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      item_type: "PART",
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
      form.reset({ item_type: "PART", description: "", quantity: 1, part_code: "" });
      setShowForm(false);
    } catch {
      // Error handled by hook
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm("Deseja remover este item?")) return;
    await deleteItem.mutateAsync({ id: itemId, workOrderId });
  };

  if (isLoading) return <Skeleton className="h-32" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" />
          Peças e Serviços Necessários
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items && items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge
                    variant="secondary"
                    className={
                      item.item_type === "SERVICE"
                        ? "bg-primary/10 text-primary shrink-0"
                        : "bg-accent/10 text-accent shrink-0"
                    }
                  >
                    {item.item_type === "SERVICE" ? (
                      <><Wrench className="h-3 w-3 mr-1" /> Serviço</>
                    ) : (
                      <><Package className="h-3 w-3 mr-1" /> Peça</>
                    )}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.description}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>Qtd: {item.quantity}</span>
                      {item.part_code && <span>Cód: {item.part_code}</span>}
                    </div>
                  </div>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {canEdit && !showForm && (
          <Button
            onClick={() => setShowForm(true)}
            className="w-full gap-2"
            variant="outline"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            Adicionar Peça/Serviço
          </Button>
        )}

        {showForm && (
          <div className="border rounded-lg p-3 space-y-3 border-primary/50">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <div className="grid gap-3 grid-cols-2">
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
                            <SelectItem value="PART">
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4" /> Peça
                              </div>
                            </SelectItem>
                            <SelectItem value="SERVICE">
                              <div className="flex items-center gap-2">
                                <Wrench className="h-4 w-4" /> Serviço
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
                        <FormLabel>Qtd *</FormLabel>
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
                        <Input placeholder="Ex: Filtro de óleo, Pastilha de freio..." {...field} />
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
                          <Input placeholder="Código opcional" {...field} />
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
                    size="sm"
                    onClick={() => { form.reset(); setShowForm(false); }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" disabled={createItem.isPending}>
                    {createItem.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                    ) : (
                      "Adicionar"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}

        {(!items || items.length === 0) && !showForm && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Adicione as peças e serviços necessários para este diagnóstico
          </p>
        )}
      </CardContent>
    </Card>
  );
}
