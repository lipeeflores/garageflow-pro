import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Search, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCreateAppointment } from "@/hooks/useAppointments";
import { useVehicleByPlate, useSearchCustomers } from "@/hooks/useVehicleByPlate";
import { useCreateCustomer } from "@/hooks/useCustomers";
import { useCreateVehicle } from "@/hooks/useVehicles";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const timeSlots = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30",
];

const formSchema = z.object({
  customer_name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  phone_number: z.string().min(10, "Telefone inválido"),
  plate: z.string().min(6, "Placa inválida").max(8, "Placa inválida"),
  vehicle_model: z.string().min(2, "Informe o modelo do veículo"),
  scheduled_date: z.string().min(1, "Selecione uma data"),
  scheduled_time: z.string().min(1, "Selecione um horário"),
  reason: z.string().min(3, "Descreva o motivo da visita"),
});

type FormData = z.infer<typeof formSchema>;

interface AppointmentFormDialogProps {
  selectedDate?: Date;
}

export function AppointmentFormDialog({ selectedDate }: AppointmentFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [plateSearch, setPlateSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [showPlateResults, setShowPlateResults] = useState(false);
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { profile } = useAuth();
  const createAppointment = useCreateAppointment();
  const createCustomer = useCreateCustomer();
  const createVehicle = useCreateVehicle();

  const { data: vehicleResults, isLoading: loadingVehicles } = useVehicleByPlate(plateSearch);
  const { data: customerResults, isLoading: loadingCustomers } = useSearchCustomers(customerSearch);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customer_name: "",
      phone_number: "",
      plate: "",
      vehicle_model: "",
      scheduled_date: selectedDate?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
      scheduled_time: "",
      reason: "",
    },
  });

  // Watch plate field for search
  const watchPlate = form.watch("plate");
  const watchCustomerName = form.watch("customer_name");

  useEffect(() => {
    if (watchPlate && watchPlate.length >= 3) {
      setPlateSearch(watchPlate.toUpperCase());
      setShowPlateResults(true);
    } else {
      setShowPlateResults(false);
    }
  }, [watchPlate]);

  useEffect(() => {
    if (watchCustomerName && watchCustomerName.length >= 2 && !selectedCustomerId) {
      setCustomerSearch(watchCustomerName);
      setShowCustomerResults(true);
    } else {
      setShowCustomerResults(false);
    }
  }, [watchCustomerName, selectedCustomerId]);

  const handleSelectVehicle = (vehicle: typeof vehicleResults[0]) => {
    form.setValue("plate", vehicle.plate);
    form.setValue("vehicle_model", `${vehicle.make} ${vehicle.model}`);
    if (vehicle.customer) {
      form.setValue("customer_name", vehicle.customer.full_name);
      form.setValue("phone_number", vehicle.customer.phone_number);
      setSelectedCustomerId(vehicle.customer.id);
    }
    setSelectedVehicleId(vehicle.id);
    setShowPlateResults(false);
  };

  const handleSelectCustomer = (customer: typeof customerResults[0]) => {
    form.setValue("customer_name", customer.full_name);
    form.setValue("phone_number", customer.phone_number);
    setSelectedCustomerId(customer.id);
    setShowCustomerResults(false);
  };

  const resetForm = () => {
    form.reset();
    setSelectedVehicleId(null);
    setSelectedCustomerId(null);
    setPlateSearch("");
    setCustomerSearch("");
  };

  const onSubmit = async (data: FormData) => {
    if (!profile?.tenant_id) return;
    
    setIsSubmitting(true);
    try {
      let customerId = selectedCustomerId;
      let vehicleId = selectedVehicleId;

      // Create customer if not selected
      if (!customerId) {
        const newCustomer = await createCustomer.mutateAsync({
          full_name: data.customer_name,
          phone_number: data.phone_number,
          email: null,
          cpf_cnpj: null,
          address: null,
          internal_notes: null,
        });
        customerId = newCustomer.id;
      }

      // Create vehicle if not selected
      if (!vehicleId && customerId) {
        // Parse make and model from vehicle_model
        const [make, ...modelParts] = data.vehicle_model.split(" ");
        const model = modelParts.join(" ") || make;
        
        const newVehicle = await createVehicle.mutateAsync({
          customer_id: customerId,
          plate: data.plate.toUpperCase(),
          make: make || "N/I",
          model: model || "N/I",
          year: null,
          color: null,
          chassis: null,
          notes: null,
        });
        vehicleId = newVehicle.id;
      }

      // Create appointment
      const scheduledAt = new Date(`${data.scheduled_date}T${data.scheduled_time}:00`);
      
      await createAppointment.mutateAsync({
        customer_id: customerId,
        vehicle_id: vehicleId,
        scheduled_at: scheduledAt.toISOString(),
        created_by: null,
        reason: data.reason,
        notes: null,
        status: "AGENDADO",
      });

      resetForm();
      setOpen(false);
    } catch (error) {
      console.error("Error creating appointment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button className="w-full gap-2 bg-accent hover:bg-accent/90">
          <Plus className="h-4 w-4" />
          Novo Agendamento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Novo Agendamento
          </DialogTitle>
          <DialogDescription>
            Preencha os dados para agendar. A busca é feita pela placa do veículo.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Customer Name with Search - First Field */}
            <FormField
              control={form.control}
              name="customer_name"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormLabel>Nome do Cliente *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="Nome completo"
                        autoComplete="off"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e.target.value);
                          setSelectedCustomerId(null);
                        }}
                      />
                      {loadingCustomers && (
                        <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </FormControl>
                  {showCustomerResults && customerResults && customerResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md">
                      {customerResults.map((customer) => (
                        <div
                          key={customer.id}
                          className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
                          onClick={() => handleSelectCustomer(customer)}
                        >
                          <div className="font-medium">{customer.full_name}</div>
                          <div className="text-muted-foreground text-xs">{customer.phone_number}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Plate - Search Field */}
            <FormField
              control={form.control}
              name="plate"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormLabel className="flex items-center gap-2">
                    <Search className="h-3 w-3" />
                    Placa do Veículo *
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="ABC1D23 ou ABC-1234"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e.target.value.toUpperCase());
                          setSelectedVehicleId(null);
                        }}
                        className="uppercase"
                      />
                      {loadingVehicles && (
                        <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </FormControl>
                  {showPlateResults && vehicleResults && vehicleResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md">
                      {vehicleResults.map((vehicle) => (
                        <div
                          key={vehicle.id}
                          className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
                          onClick={() => handleSelectVehicle(vehicle)}
                        >
                          <div className="font-medium">{vehicle.plate} - {vehicle.make} {vehicle.model}</div>
                          {vehicle.customer && (
                            <div className="text-muted-foreground text-xs">
                              {vehicle.customer.full_name} • {vehicle.customer.phone_number}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Vehicle Model */}
            <FormField
              control={form.control}
              name="vehicle_model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modelo do Veículo *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Honda Civic" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phone */}
            <FormField
              control={form.control}
              name="phone_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone *</FormLabel>
                  <FormControl>
                    <Input placeholder="(11) 99999-9999" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="scheduled_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scheduled_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timeSlots.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Reason */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo / Queixa *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o motivo da visita ou queixa do cliente"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Info about new records */}
            {(!selectedCustomerId || !selectedVehicleId) && (form.watch("customer_name") || form.watch("plate")) && (
              <div className="text-xs text-muted-foreground bg-muted p-2 rounded-md">
                {!selectedCustomerId && form.watch("customer_name") && (
                  <p>📝 Novo cliente será cadastrado: <strong>{form.watch("customer_name")}</strong></p>
                )}
                {!selectedVehicleId && form.watch("plate") && (
                  <p>🚗 Novo veículo será cadastrado: <strong>{form.watch("plate")}</strong></p>
                )}
              </div>
            )}

            <DialogFooter>
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
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Agendando...
                  </>
                ) : (
                  "Agendar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
