import { 
  createPDF, 
  addHeaderWithLogo,
  addFooter, 
  addSectionTitle, 
  addInfoGrid, 
  addTable,
  addTotalRow,
  formatCurrency, 
  formatDate,
  formatDateTime,
  downloadPDF,
  checkPageBreak
} from './pdfBase';

interface WorkOrderData {
  id: string;
  created_at: string;
  workflow_step: string;
  initial_complaint: string | null;
  total_amount: number | null;
  priority: string | null;
  box_location: string | null;
  expected_delivery_date: string | null;
  customer: {
    full_name: string;
    phone_number: string;
    email: string | null;
  };
  vehicle: {
    plate: string;
    make: string;
    model: string;
    year: number | null;
    color: string | null;
  };
  mechanic?: {
    full_name: string;
  } | null;
  items: Array<{
    description: string;
    item_type: string;
    quantity: number;
    pricing?: {
      unit_price: number;
      total_price: number;
    };
  }>;
  diagnostics: Array<{
    technical_report: string;
    created_at: string;
    mechanic_name?: string;
  }>;
  checkin?: {
    km_current: number;
    fuel_level: string;
    customer_items: string | null;
    observations: string | null;
  };
  events: Array<{
    event_type: string;
    description: string | null;
    created_at: string;
  }>;
}

const workflowStepLabels: Record<string, string> = {
  AGUARDANDO_CHECKIN: 'Aguardando Check-in',
  CHECKIN_CONCLUIDO: 'Check-in Concluído',
  EM_DIAGNOSTICO: 'Em Diagnóstico',
  AGUARDANDO_ORCAMENTO: 'Aguardando Orçamento',
  AGUARDANDO_APROVACAO: 'Aguardando Aprovação',
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em Execução',
  EM_QUALIDADE: 'Em Qualidade',
  AJUSTES: 'Ajustes',
  PRONTO_PARA_RETIRADA: 'Pronto para Retirada',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
};

const priorityLabels: Record<string, string> = {
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
};

const fuelLevelLabels: Record<string, string> = {
  RESERVA: 'Reserva',
  QUARTO: '1/4',
  METADE: '1/2',
  TRES_QUARTOS: '3/4',
  COMPLETO: 'Completo',
};

export async function generateWorkOrderPDF(data: WorkOrderData): Promise<void> {
  const doc = createPDF();
  
  // Header with logo
  let y = await addHeaderWithLogo(
    doc, 
    'Ordem de Serviço',
    `OS #${data.id.slice(0, 8).toUpperCase()}`
  );
  
  // Status and basic info
  y = addSectionTitle(doc, 'Informações da OS', y);
  y = addInfoGrid(doc, [
    { label: 'Status', value: workflowStepLabels[data.workflow_step] || data.workflow_step },
    { label: 'Data de Abertura', value: formatDateTime(data.created_at) },
    { label: 'Prioridade', value: priorityLabels[data.priority || ''] || 'Normal' },
    { label: 'Box', value: data.box_location?.replace('_', ' ') || 'Não definido' },
    { label: 'Previsão de Entrega', value: formatDate(data.expected_delivery_date) },
    { label: 'Mecânico Responsável', value: data.mechanic?.full_name || 'Não atribuído' },
  ], y);
  
  // Customer info
  y = checkPageBreak(doc, y, 40);
  y = addSectionTitle(doc, 'Dados do Cliente', y);
  y = addInfoGrid(doc, [
    { label: 'Nome', value: data.customer.full_name },
    { label: 'Telefone', value: data.customer.phone_number },
    { label: 'Email', value: data.customer.email || '-' },
  ], y, 3);
  
  // Vehicle info
  y = checkPageBreak(doc, y, 40);
  y = addSectionTitle(doc, 'Dados do Veículo', y);
  y = addInfoGrid(doc, [
    { label: 'Placa', value: data.vehicle.plate },
    { label: 'Marca/Modelo', value: `${data.vehicle.make} ${data.vehicle.model}` },
    { label: 'Ano', value: data.vehicle.year?.toString() || '-' },
    { label: 'Cor', value: data.vehicle.color || '-' },
  ], y);
  
  // Check-in info
  if (data.checkin) {
    y = checkPageBreak(doc, y, 50);
    y = addSectionTitle(doc, 'Check-in do Veículo', y);
    y = addInfoGrid(doc, [
      { label: 'Quilometragem', value: `${data.checkin.km_current.toLocaleString('pt-BR')} km` },
      { label: 'Nível de Combustível', value: fuelLevelLabels[data.checkin.fuel_level] || data.checkin.fuel_level },
    ], y);
    
    if (data.checkin.customer_items) {
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Itens do Cliente:', 14, y);
      doc.setTextColor(30, 41, 59);
      const itemLines = doc.splitTextToSize(data.checkin.customer_items, 180);
      doc.text(itemLines, 14, y + 5);
      y += 5 + (itemLines.length * 4);
    }
    
    if (data.checkin.observations) {
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Observações:', 14, y);
      doc.setTextColor(30, 41, 59);
      const obsLines = doc.splitTextToSize(data.checkin.observations, 180);
      doc.text(obsLines, 14, y + 5);
      y += 5 + (obsLines.length * 4);
    }
    y += 5;
  }
  
  // Initial complaint
  if (data.initial_complaint) {
    y = checkPageBreak(doc, y, 30);
    y = addSectionTitle(doc, 'Reclamação Inicial', y);
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    const complaintLines = doc.splitTextToSize(data.initial_complaint, 180);
    doc.text(complaintLines, 14, y);
    y += (complaintLines.length * 5) + 5;
  }
  
  // Diagnosis
  if (data.diagnostics && data.diagnostics.length > 0) {
    y = checkPageBreak(doc, y, 40);
    y = addSectionTitle(doc, 'Diagnóstico Técnico', y);
    
    data.diagnostics.forEach((diag) => {
      y = checkPageBreak(doc, y, 25);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`${formatDateTime(diag.created_at)}${diag.mechanic_name ? ` - ${diag.mechanic_name}` : ''}`, 14, y);
      y += 5;
      
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      const reportLines = doc.splitTextToSize(diag.technical_report, 180);
      doc.text(reportLines, 14, y);
      y += (reportLines.length * 5) + 8;
    });
  }
  
  // Items and services
  if (data.items && data.items.length > 0) {
    y = checkPageBreak(doc, y, 50);
    y = addSectionTitle(doc, 'Serviços e Peças', y);
    
    const services = data.items.filter(i => i.item_type === 'SERVICE');
    const parts = data.items.filter(i => i.item_type === 'PART');
    
    if (services.length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Serviços:', 14, y);
      y += 5;
      
      y = addTable(
        doc,
        ['Descrição', 'Qtd', 'Valor Unit.', 'Total'],
        services.map(s => [
          s.description,
          s.quantity.toString(),
          s.pricing ? formatCurrency(s.pricing.unit_price) : '-',
          s.pricing ? formatCurrency(s.pricing.total_price) : '-',
        ]),
        y,
        {
          columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 20, halign: 'center' },
            2: { cellWidth: 35, halign: 'right' },
            3: { cellWidth: 35, halign: 'right' },
          },
        }
      );
    }
    
    if (parts.length > 0) {
      y = checkPageBreak(doc, y, 40);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Peças:', 14, y);
      y += 5;
      
      y = addTable(
        doc,
        ['Descrição', 'Qtd', 'Valor Unit.', 'Total'],
        parts.map(p => [
          p.description,
          p.quantity.toString(),
          p.pricing ? formatCurrency(p.pricing.unit_price) : '-',
          p.pricing ? formatCurrency(p.pricing.total_price) : '-',
        ]),
        y,
        {
          columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 20, halign: 'center' },
            2: { cellWidth: 35, halign: 'right' },
            3: { cellWidth: 35, halign: 'right' },
          },
        }
      );
    }
    
    // Total
    if (data.total_amount) {
      y = checkPageBreak(doc, y, 20);
      y = addTotalRow(doc, 'TOTAL GERAL', formatCurrency(data.total_amount), y);
    }
  }
  
  // Timeline
  if (data.events && data.events.length > 0) {
    y = checkPageBreak(doc, y, 50);
    y = addSectionTitle(doc, 'Histórico de Eventos', y);
    
    y = addTable(
      doc,
      ['Data/Hora', 'Evento', 'Descrição'],
      data.events.slice(0, 15).map(e => [
        formatDateTime(e.created_at),
        e.event_type.replace(/_/g, ' '),
        e.description || '-',
      ]),
      y,
      {
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 50 },
          2: { cellWidth: 90 },
        },
      }
    );
  }
  
  // Footer
  addFooter(doc, 1);
  
  // Download
  downloadPDF(doc, `OS_${data.id.slice(0, 8).toUpperCase()}_${formatDate(data.created_at).replace(/\//g, '-')}`);
}
