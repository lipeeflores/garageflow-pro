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
  Plus,
  Search,
  Car,
  User,
  FileText,
  MoreHorizontal,
  ChevronRight,
  Calendar,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

interface Vehicle {
  id: string;
  plate: string;
  make: string;
  model: string;
  year: number;
  color: string;
  owner: string;
  osCount: number;
  lastService: string;
}

const mockVehicles: Vehicle[] = [
  {
    id: "1",
    plate: "ABC-1234",
    make: "Honda",
    model: "Civic",
    year: 2020,
    color: "Prata",
    owner: "João Silva",
    osCount: 5,
    lastService: "02/02/2026",
  },
  {
    id: "2",
    plate: "DEF-5678",
    make: "Toyota",
    model: "Corolla",
    year: 2019,
    color: "Branco",
    owner: "Maria Santos",
    osCount: 3,
    lastService: "28/01/2026",
  },
  {
    id: "3",
    plate: "GHI-9012",
    make: "Volkswagen",
    model: "Golf",
    year: 2021,
    color: "Preto",
    owner: "Pedro Oliveira",
    osCount: 8,
    lastService: "25/01/2026",
  },
  {
    id: "4",
    plate: "JKL-3456",
    make: "Fiat",
    model: "Argo",
    year: 2022,
    color: "Vermelho",
    owner: "Ana Costa",
    osCount: 2,
    lastService: "20/01/2026",
  },
  {
    id: "5",
    plate: "MNO-7890",
    make: "Chevrolet",
    model: "Onix",
    year: 2020,
    color: "Azul",
    owner: "Carlos Eduardo",
    osCount: 10,
    lastService: "18/01/2026",
  },
  {
    id: "6",
    plate: "PQR-1122",
    make: "Hyundai",
    model: "HB20",
    year: 2021,
    color: "Cinza",
    owner: "Carlos Eduardo",
    osCount: 5,
    lastService: "15/01/2026",
  },
];

export default function Veiculos() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredVehicles = mockVehicles.filter(
    (vehicle) =>
      vehicle.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.owner.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout title="Veículos" subtitle="Gerenciamento de veículos cadastrados">
      <div className="space-y-6 animate-fade-in">
        {/* Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por placa, marca, modelo ou proprietário..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Button className="gap-2 bg-accent hover:bg-accent/90">
            <Plus className="h-4 w-4" />
            Novo Veículo
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Car className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Veículos</p>
                <p className="font-display text-2xl font-bold">
                  {mockVehicles.length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Atendidos Hoje</p>
                <p className="font-display text-2xl font-bold">3</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de OS</p>
                <p className="font-display text-2xl font-bold">
                  {mockVehicles.reduce((acc, v) => acc + v.osCount, 0)}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Placa</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead>Proprietário</TableHead>
                  <TableHead className="text-center">OS</TableHead>
                  <TableHead>Último Serviço</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVehicles.map((vehicle) => (
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
                          <p className="text-sm text-muted-foreground">
                            {vehicle.year}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{vehicle.color}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{vehicle.owner}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{vehicle.osCount}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {vehicle.lastService}
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
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <ChevronRight className="mr-2 h-4 w-4" />
                            Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <FileText className="mr-2 h-4 w-4" />
                            Histórico de OS
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Plus className="mr-2 h-4 w-4" />
                            Nova OS
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
