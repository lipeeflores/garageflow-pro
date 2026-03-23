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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus, Pencil, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const userFormSchema = z.object({
  email: z.string().email("Email inválido"),
  full_name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  phone: z.string().optional(),
  role: z.enum(["ADMIN", "MANAGER", "MECHANIC", "PATIO"]),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional(),
});

type UserFormData = z.infer<typeof userFormSchema>;

interface TeamMember {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean | null;
  user_roles: { role: string }[];
}

// Create User Dialog
export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: "",
      full_name: "",
      phone: "",
      role: "MECHANIC",
      password: "",
    },
  });

  const createUser = useMutation({
    mutationFn: async (data: UserFormData) => {
      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password || "temp123456",
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: data.full_name,
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Falha ao criar usuário");

      // 2. Create profile
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: authData.user.id,
          tenant_id: profile.tenant_id,
          full_name: data.full_name,
          email: data.email,
          phone: data.phone || null,
          is_active: true,
        });

      if (profileError) throw profileError;

      // 3. Create user role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          tenant_id: profile.tenant_id,
          role: data.role,
        });

      if (roleError) throw roleError;

      return authData.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team_members"] });
      toast({
        title: "Sucesso",
        description: "Usuário criado com sucesso. Um email de confirmação foi enviado.",
      });
      form.reset();
      setOpen(false);
    },
    onError: (error: any) => {
      let message = "Erro ao criar usuário";
      if (error.message?.includes("already registered")) {
        message = "Este email já está cadastrado";
      }
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UserFormData) => {
    createUser.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Criar Novo Usuário
          </DialogTitle>
          <DialogDescription>
            Adicione um novo membro à equipe da oficina.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo *</FormLabel>
                  <FormControl>
                    <Input placeholder="João Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="joao@oficina.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha Inicial *</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="******" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input placeholder="(47) 99999-9999" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Função *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a função" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="MECHANIC">Mecânico</SelectItem>
                      <SelectItem value="PATIO">PC do Pátio</SelectItem>
                      <SelectItem value="MANAGER">Gerente</SelectItem>
                      <SelectItem value="ADMIN">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  "Criar Usuário"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Edit User Dialog
interface EditUserDialogProps {
  user: TeamMember;
  trigger?: React.ReactNode;
}

export function EditUserDialog({ user, trigger }: EditUserDialogProps) {
  const [open, setOpen] = useState(false);
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<Omit<UserFormData, "password">>({
    resolver: zodResolver(userFormSchema.omit({ password: true })),
    defaultValues: {
      full_name: user.full_name,
      email: user.email || "",
      phone: user.phone || "",
      role: (user.user_roles?.[0]?.role as "ADMIN" | "MANAGER" | "MECHANIC") || "MECHANIC",
    },
  });

  const updateUser = useMutation({
    mutationFn: async (data: Omit<UserFormData, "password">) => {
      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: data.full_name,
          email: data.email,
          phone: data.phone || null,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Update role if changed
      const currentRole = user.user_roles?.[0]?.role;
      if (currentRole !== data.role) {
        // Delete existing role
        await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", user.id)
          .eq("tenant_id", profile.tenant_id);

        // Insert new role
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: user.id,
            tenant_id: profile.tenant_id,
            role: data.role,
          });

        if (roleError) throw roleError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team_members"] });
      toast({
        title: "Sucesso",
        description: "Usuário atualizado com sucesso.",
      });
      setOpen(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar usuário.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: Omit<UserFormData, "password">) => {
    updateUser.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Editar Usuário
          </DialogTitle>
          <DialogDescription>
            Altere as informações do membro da equipe.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Função *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a função" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="MECHANIC">Mecânico</SelectItem>
                      <SelectItem value="PATIO">PC do Pátio</SelectItem>
                      <SelectItem value="MANAGER">Gerente</SelectItem>
                      <SelectItem value="ADMIN">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateUser.isPending}>
                {updateUser.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Toggle User Status
interface ToggleUserStatusProps {
  user: TeamMember;
}

export function ToggleUserStatus({ user }: ToggleUserStatusProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const toggleStatus = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: !user.is_active })
        .eq("id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team_members"] });
      toast({
        title: "Sucesso",
        description: `Usuário ${user.is_active ? "desativado" : "ativado"} com sucesso.`,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao alterar status do usuário.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={user.is_active ?? true}
        onCheckedChange={() => toggleStatus.mutate()}
        disabled={toggleStatus.isPending || user.id === profile?.id}
      />
      <Label className="text-sm text-muted-foreground">
        {user.is_active ? "Ativo" : "Inativo"}
      </Label>
    </div>
  );
}

// Delete User Dialog
interface DeleteUserDialogProps {
  user: TeamMember;
  trigger?: React.ReactNode;
}

export function DeleteUserDialog({ user, trigger }: DeleteUserDialogProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteUser = useMutation({
    mutationFn: async () => {
      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      // Delete user role
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", user.id)
        .eq("tenant_id", profile.tenant_id);

      // Delete profile (cascade should handle related data)
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team_members"] });
      toast({
        title: "Sucesso",
        description: "Usuário removido com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao remover usuário. Verifique se não há dados vinculados.",
        variant: "destructive",
      });
    },
  });

  if (user.id === profile?.id) {
    return null; // Can't delete yourself
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja remover o usuário <strong>{user.full_name}</strong>?
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteUser.mutate()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteUser.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Removendo...
              </>
            ) : (
              "Remover Usuário"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
