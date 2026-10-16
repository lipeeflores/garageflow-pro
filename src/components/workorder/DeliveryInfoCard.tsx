import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useUpdateWorkOrder } from "@/hooks/useWorkOrders";

interface Props {
  workOrder: {
    id: string;
    km_saida?: number | null;
    garantia_ate?: string | null;
    proxima_revisao_km?: number | null;
    proxima_revisao_data?: string | null;
    entregue_em?: string | null;
  };
  canEdit: boolean;
}

export function DeliveryInfoCard({ workOrder, canEdit }: Props) {
  const update = useUpdateWorkOrder();
  const [kmSaida, setKmSaida] = useState("");
  const [garantia, setGarantia] = useState("");
  const [revKm, setRevKm] = useState("");
  const [revData, setRevData] = useState("");

  useEffect(() => {
    setKmSaida(workOrder.km_saida?.toString() ?? "");
    setGarantia(workOrder.garantia_ate ?? "");
    setRevKm(workOrder.proxima_revisao_km?.toString() ?? "");
    setRevData(workOrder.proxima_revisao_data ?? "");
  }, [workOrder.id, workOrder.km_saida, workOrder.garantia_ate, workOrder.proxima_revisao_km, workOrder.proxima_revisao_data]);

  const fmtDate = (d?: string | null) => (d ? format(new Date(d + "T12:00:00"), "dd/MM/yyyy") : "—");

  const save = () =>
    update.mutateAsync({
      id: workOrder.id,
      updates: {
        km_saida: kmSaida ? Number(kmSaida) : null,
        garantia_ate: garantia || null,
        proxima_revisao_km: revKm ? Number(revKm) : null,
        proxima_revisao_data: revData || null,
      },
    });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Dados de Entrega</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {canEdit ? (
          <>
            <div className="space-y-1">
              <Label>Km de saída</Label>
              <Input type="number" min={0} value={kmSaida} onChange={(e) => setKmSaida(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Garantia até</Label>
              <Input type="date" value={garantia} onChange={(e) => setGarantia(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Próx. revisão (km)</Label>
                <Input type="number" min={0} value={revKm} onChange={(e) => setRevKm(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Próx. revisão (data)</Label>
                <Input type="date" value={revData} onChange={(e) => setRevData(e.target.value)} />
              </div>
            </div>
            <Button className="w-full" onClick={save} disabled={update.isPending}>
              Salvar dados de entrega
            </Button>
          </>
        ) : (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Km de saída</dt>
            <dd>{workOrder.km_saida?.toLocaleString("pt-BR") ?? "—"}</dd>
            <dt className="text-muted-foreground">Garantia até</dt>
            <dd>{fmtDate(workOrder.garantia_ate)}</dd>
            <dt className="text-muted-foreground">Próx. revisão</dt>
            <dd>
              {workOrder.proxima_revisao_km ? `${workOrder.proxima_revisao_km.toLocaleString("pt-BR")} km` : "—"}
              {" · "}
              {fmtDate(workOrder.proxima_revisao_data)}
            </dd>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
