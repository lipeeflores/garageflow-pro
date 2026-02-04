import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Car,
  User,
  FileText,
  MoreHorizontal,
  ChevronRight,
  Loader2,
  Plus,
  Pencil,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVehicles, type Vehicle } from "@/hooks/useVehicles";
import { VehicleFormDialog, VehicleEditDialog } from "@/components/forms";

export default function Veiculos() {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const navigate = useNavigate();
  const { data: vehicles, isLoading, error } = useVehicles(searchQuery || undefined);

  return (
    <AppLayout title="Veículos" subtitle="Gerenciamento de veículos cadastrados">
      <div className="space-y-6 animate-fade-in">
        {/* Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por placa, marca ou modelo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <VehicleFormDialog />
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Car className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Veículos</p>
                <p className="font-display text-2xl font-bold">
                  {vehicles?.length ?? 0}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Lista de Veículos</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                Erro ao carregar veículos
              </div>
            ) : vehicles?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Car className="h-12 w-12 mb-4 opacity-50" />
                <p>Nenhum veículo cadastrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Placa</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead>Cor</TableHead>
                    <TableHead>Proprietário</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles?.map((vehicle) => (
                    <TableRow key={vehicle.id} className="group cursor-pointer">
                      <TableCell>
                        <span className="font-display text-base font-bold">
                          {vehicle.plate}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <Car className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {vehicle.make} {vehicle.model}
                            </p>
                            {vehicle.year && (
                              <p className="text-sm text-muted-foreground">
                                {vehicle.year}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {vehicle.color ? (
                          <Badge variant="secondary">{vehicle.color}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {vehicle.customer ? (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{vehicle.customer.full_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => setEditingVehicle(vehicle)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar Veículo
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => vehicle.customer && navigate(`/clientes/${vehicle.customer_id}`)}
                            >
                              <ChevronRight className="mr-2 h-4 w-4" />
                              Ver Proprietário
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/ordens?vehicle=${vehicle.plate}`)}>
                              <FileText className="mr-2 h-4 w-4" />
                              Histórico de OS
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        {editingVehicle && (
          <VehicleEditDialog
            vehicle={editingVehicle}
            open={!!editingVehicle}
            onOpenChange={(open) => !open && setEditingVehicle(null)}
            onSuccess={() => setEditingVehicle(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
