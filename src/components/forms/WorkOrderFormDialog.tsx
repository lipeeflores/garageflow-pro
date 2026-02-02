import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCreateWorkOrder } from "@/hooks/useWorkOrders";
import { useCustomers } from "@/hooks/useCustomers";
import { useVehiclesByCustomer } from "@/hooks/useVehicles";
import { Loader2, Plus, FileText } from "lucide-react";

const workOrderSchema = z.object({
  customer_id: z.string().min(1, "Selecione um cliente"),
  vehicle_id: z.string().min(1, "Selecione um veículo"),
  initial_complaint: z.string().min(5, "Descreva a reclamação do cliente"),
  priority: z.enum(["BAIXA", "MEDIA", "ALTA"]),
});

type WorkOrderFormData = z.infer<typeof workOrderSchema>;

interface WorkOrderFormDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: (workOrderId: string) => void;
}

export function WorkOrderFormDialog({ trigger, onSuccess }: WorkOrderFormDialogProps) {
  const [open, setOpen] = useState(false);
  const createWorkOrder = useCreateWorkOrder();
  const { data: customers, isLoading: loadingCustomers } = useCustomers();
  
  const form = useForm<WorkOrderFormData>({
    resolver: zodResolver(workOrderSchema),
    defaultValues: {
      customer_id: "",
      vehicle_id: "",
      initial_complaint: "",
      priority: "MEDIA",
    },
  });

  const selectedCustomerId = form.watch("customer_id");
  const { data: vehicles, isLoading: loadingVehicles } = useVehiclesByCustomer(selectedCustomerId);

  const onSubmit = async (data: WorkOrderFormData) => {
    try {
      const result = await createWorkOrder.mutateAsync({
        customer_id: data.customer_id,
        vehicle_id: data.vehicle_id,
        initial_complaint: data.initial_complaint,
        priority: data.priority,
        workflow_step: "AGUARDANDO_CHECKIN",
      });
      
      form.reset();
      setOpen(false);
      onSuccess?.(result.id);
    } catch (error) {
      // Error handled by hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2 bg-accent hover:bg-accent/90">
            <Plus className="h-4 w-4" />
            Nova OS
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Nova Ordem de Serviço
          </DialogTitle>
          <DialogDescription>
            Crie uma nova OS para iniciar o atendimento.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente *</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("vehicle_id", "");
                    }} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {loadingCustomers ? (
                        <SelectItem value="loading" disabled>Carregando...</SelectItem>
                      ) : customers?.length === 0 ? (
                        <SelectItem value="empty" disabled>Nenhum cliente cadastrado</SelectItem>
                      ) : (
                        customers?.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.full_name} - {customer.phone_number}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vehicle_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Veículo *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedCustomerId}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={selectedCustomerId ? "Selecione o veículo" : "Selecione um cliente primeiro"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {loadingVehicles ? (
                        <SelectItem value="loading" disabled>Carregando...</SelectItem>
                      ) : vehicles?.length === 0 ? (
                        <SelectItem value="empty" disabled>Nenhum veículo cadastrado para este cliente</SelectItem>
                      ) : (
                        vehicles?.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id}>
                            {vehicle.plate} - {vehicle.make} {vehicle.model} {vehicle.year && `(${vehicle.year})`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prioridade</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a prioridade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="BAIXA">🟢 Baixa</SelectItem>
                      <SelectItem value="MEDIA">🟡 Média</SelectItem>
                      <SelectItem value="ALTA">🔴 Alta</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="initial_complaint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reclamação do Cliente *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descreva o problema relatado pelo cliente..."
                      className="resize-none min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-accent hover:bg-accent/90"
                disabled={createWorkOrder.isPending}
              >
                {createWorkOrder.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  "Criar OS"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
