import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Building2,
  Users,
  Bell,
  Palette,
  Clock,
  Shield,
  Wrench,
  Save,
  Loader2,
  User,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/useTheme";

interface TenantSettings {
  company_name?: string;
  cnpj?: string;
  address?: string;
  phone?: string;
  email?: string;
  working_hours_start?: string;
  working_hours_end?: string;
  lunch_start?: string;
  lunch_end?: string;
  notifications_enabled?: boolean;
  sound_alerts_enabled?: boolean;
}

interface TeamMember {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean | null;
  user_roles: { role: string }[];
}

function useTeamMembers() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['team_members', profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [] as TeamMember[];

      // Get profiles first
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, is_active')
        .eq('tenant_id', profile.tenant_id)
        .order('full_name');

      if (profilesError) throw profilesError;

      // Get user roles separately
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('tenant_id', profile.tenant_id);

      if (rolesError) throw rolesError;

      // Merge profiles with roles
      const result: TeamMember[] = profiles.map(p => ({
        ...p,
        user_roles: roles.filter(r => r.user_id === p.id).map(r => ({ role: r.role })),
      }));

      return result;
    },
    enabled: !!profile?.tenant_id,
  });
}

function useTenantSettings() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['tenant_settings', profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return null;

      const { data, error } = await supabase
        .from('tenants')
        .select('name, settings')
        .eq('id', profile.tenant_id)
        .single();

      if (error) throw error;
      return {
        name: data.name,
        ...(data.settings as TenantSettings || {}),
      };
    },
    enabled: !!profile?.tenant_id,
  });
}

function useUpdateTenantSettings() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (settings: TenantSettings & { name?: string }) => {
      if (!profile?.tenant_id) throw new Error("Tenant not found");

      const { name, ...restSettings } = settings;

      // Build settings as JSON-compatible object
      const settingsJson = JSON.parse(JSON.stringify(restSettings));

      const { error } = await supabase
        .from('tenants')
        .update({
          ...(name && { name }),
          settings: settingsJson,
        })
        .eq('id', profile.tenant_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant_settings'] });
      toast({
        title: "Configurações salvas",
        description: "As configurações foram atualizadas com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    },
  });
}

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  MECHANIC: "Mecânico",
};

const roleColors: Record<string, string> = {
  ADMIN: "bg-destructive/20 text-destructive",
  MANAGER: "bg-warning/20 text-warning",
  MECHANIC: "bg-info/20 text-info",
};

export default function Configuracoes() {
  const { profile, isAdmin } = useAuth();
  const { data: settings, isLoading: loadingSettings } = useTenantSettings();
  const { data: teamMembers, isLoading: loadingTeam } = useTeamMembers();
  const updateSettings = useUpdateTenantSettings();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [formData, setFormData] = useState<TenantSettings & { name?: string }>({});

  // Initialize form data when settings load
  useState(() => {
    if (settings) {
      setFormData(settings);
    }
  });

  const handleSaveCompanySettings = () => {
    updateSettings.mutate({
      ...settings,
      ...formData,
    });
  };

  if (!isAdmin) {
    return (
      <AppLayout title="Configurações" subtitle="Acesso restrito">
        <div className="flex flex-col items-center justify-center py-12">
          <Shield className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 font-display text-lg font-semibold">
            Acesso Restrito
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Apenas administradores podem acessar as configurações.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Configurações" subtitle="Gerencie as configurações do sistema">
      <div className="space-y-6 animate-fade-in">
        <Tabs defaultValue="company" className="space-y-6">
          <TabsList className="bg-muted/50 w-full grid grid-cols-2 sm:grid-cols-4 h-auto">
            <TabsTrigger value="company" className="gap-2 py-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Empresa</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2 py-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Equipe</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2 py-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Horários</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-2 py-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Preferências</span>
            </TabsTrigger>
          </TabsList>

          {/* Company Settings */}
          <TabsContent value="company" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Dados da Empresa
                </CardTitle>
                <CardDescription>
                  Informações que aparecem em relatórios e documentos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingSettings ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10" />)}
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="company_name">Nome da Empresa</Label>
                        <Input
                          id="company_name"
                          placeholder="MD Mecânica"
                          defaultValue={settings?.name || ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cnpj">CNPJ</Label>
                        <Input
                          id="cnpj"
                          placeholder="00.000.000/0001-00"
                          defaultValue={settings?.cnpj || ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, cnpj: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Endereço</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="address"
                          placeholder="Rua, número, bairro - Cidade/UF"
                          className="pl-9"
                          defaultValue={settings?.address || ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefone</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="phone"
                            placeholder="(47) 3333-3333"
                            className="pl-9"
                            defaultValue={settings?.phone || ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="email"
                            type="email"
                            placeholder="contato@oficina.com"
                            className="pl-9"
                            defaultValue={settings?.email || ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex justify-end">
                      <Button 
                        onClick={handleSaveCompanySettings}
                        disabled={updateSettings.isPending}
                        className="gap-2"
                      >
                        {updateSettings.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Salvar Alterações
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Management */}
          <TabsContent value="team" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Equipe
                </CardTitle>
                <CardDescription>
                  Membros da equipe e seus papéis no sistema.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTeam ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Membro</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamMembers?.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                                {member.full_name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium">{member.full_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {member.email || member.phone || "-"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {member.user_roles?.[0]?.role && (
                              <Badge className={roleColors[member.user_roles[0].role]}>
                                {roleLabels[member.user_roles[0].role]}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={member.is_active ? "default" : "secondary"}>
                              {member.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schedule Settings */}
          <TabsContent value="schedule" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Horário de Funcionamento
                </CardTitle>
                <CardDescription>
                  Configure os horários de trabalho da oficina.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingSettings ? (
                  <div className="space-y-4">
                    {[1, 2].map(i => <Skeleton key={i} className="h-10" />)}
                  </div>
                ) : (
                  <>
                    <div>
                      <h4 className="text-sm font-medium mb-3">Expediente</h4>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="start_time">Entrada</Label>
                          <Input
                            id="start_time"
                            type="time"
                            defaultValue={settings?.working_hours_start || "08:00"}
                            onChange={(e) => setFormData(prev => ({ ...prev, working_hours_start: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="end_time">Saída</Label>
                          <Input
                            id="end_time"
                            type="time"
                            defaultValue={settings?.working_hours_end || "18:00"}
                            onChange={(e) => setFormData(prev => ({ ...prev, working_hours_end: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="text-sm font-medium mb-3">Intervalo de Almoço</h4>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="lunch_start">Início</Label>
                          <Input
                            id="lunch_start"
                            type="time"
                            defaultValue={settings?.lunch_start || "12:00"}
                            onChange={(e) => setFormData(prev => ({ ...prev, lunch_start: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lunch_end">Retorno</Label>
                          <Input
                            id="lunch_end"
                            type="time"
                            defaultValue={settings?.lunch_end || "13:00"}
                            onChange={(e) => setFormData(prev => ({ ...prev, lunch_end: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex justify-end">
                      <Button 
                        onClick={handleSaveCompanySettings}
                        disabled={updateSettings.isPending}
                        className="gap-2"
                      >
                        {updateSettings.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Salvar Horários
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences */}
          <TabsContent value="preferences" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Preferências
                </CardTitle>
                <CardDescription>
                  Personalize a aparência e comportamento do sistema.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Theme */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Tema</Label>
                    <p className="text-sm text-muted-foreground">
                      Escolha entre tema claro, escuro ou automático.
                    </p>
                  </div>
                  <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Claro</SelectItem>
                      <SelectItem value="dark">Escuro</SelectItem>
                      <SelectItem value="system">Sistema</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Notifications */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      Notificações
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receba alertas de novas OS e eventos importantes.
                    </p>
                  </div>
                  <Switch
                    checked={formData.notifications_enabled ?? settings?.notifications_enabled ?? true}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, notifications_enabled: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      Sons de Alerta
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Tocar som ao receber novas notificações.
                    </p>
                  </div>
                  <Switch
                    checked={formData.sound_alerts_enabled ?? settings?.sound_alerts_enabled ?? true}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, sound_alerts_enabled: checked }))}
                  />
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button 
                    onClick={handleSaveCompanySettings}
                    disabled={updateSettings.isPending}
                    className="gap-2"
                  >
                    {updateSettings.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Salvar Preferências
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
