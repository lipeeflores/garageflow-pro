import { 
  createPDF, 
  addHeader, 
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

interface CustomerHistoryReportData {
  customer: {
    id: string;
    full_name: string;
    phone_number: string;
    email: string | null;
    cpf_cnpj: string | null;
    address: string | null;
    created_at: string;
  };
  vehicles: Array<{
    plate: string;
    make: string;
    model: string;
    year: number | null;
  }>;
  workOrders: Array<{
    id: string;
    created_at: string;
    workflow_step: string;
    initial_complaint: string | null;
    total_amount: number | null;
    vehicle_plate: string;
  }>;
  payments: Array<{
    amount: number;
    payment_method: string;
    paid_at: string | null;
  }>;
  stats: {
    totalOrders: number;
    totalSpent: number;
    averageTicket: number;
    firstVisit: string | null;
    lastVisit: string | null;
  };
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

const paymentMethodLabels: Record<string, string> = {
  PIX: 'PIX',
  CARTAO: 'Cartão',
  DINHEIRO: 'Dinheiro',
  MARCAR: 'A Prazo',
};

export function generateCustomerHistoryPDF(data: CustomerHistoryReportData): void {
  const doc = createPDF();
  
  // Header
  let y = addHeader(
    doc, 
    'Histórico do Cliente',
    data.customer.full_name
  );
  
  // Customer info
  y = addSectionTitle(doc, 'Dados do Cliente', y);
  y = addInfoGrid(doc, [
    { label: 'Nome Completo', value: data.customer.full_name },
    { label: 'Telefone', value: data.customer.phone_number },
    { label: 'Email', value: data.customer.email || '-' },
    { label: 'CPF/CNPJ', value: data.customer.cpf_cnpj || '-' },
    { label: 'Endereço', value: data.customer.address || '-' },
    { label: 'Cliente desde', value: formatDate(data.customer.created_at) },
  ], y, 2);
  
  // Stats summary
  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, 'Resumo do Cliente', y);
  
  const statsData = [
    { label: 'Total de Ordens', value: data.stats.totalOrders.toString() },
    { label: 'Total Gasto', value: formatCurrency(data.stats.totalSpent) },
    { label: 'Ticket Médio', value: formatCurrency(data.stats.averageTicket) },
    { label: 'Primeira Visita', value: formatDate(data.stats.firstVisit) },
    { label: 'Última Visita', value: formatDate(data.stats.lastVisit) },
    { label: 'Veículos Cadastrados', value: data.vehicles.length.toString() },
  ];
  
  y = addInfoGrid(doc, statsData, y, 3);
  
  // Total spent highlight
  y += 5;
  y = addTotalRow(doc, 'VALOR TOTAL EM SERVIÇOS', formatCurrency(data.stats.totalSpent), y);
  
  // Vehicles
  if (data.vehicles.length > 0) {
    y = checkPageBreak(doc, y, 50);
    y = addSectionTitle(doc, 'Veículos do Cliente', y);
    
    y = addTable(
      doc,
      ['Placa', 'Marca', 'Modelo', 'Ano'],
      data.vehicles.map(v => [
        v.plate,
        v.make,
        v.model,
        v.year?.toString() || '-',
      ]),
      y,
      {
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 50 },
          2: { cellWidth: 60 },
          3: { cellWidth: 35, halign: 'center' },
        },
      }
    );
  }
  
  // Work orders history
  if (data.workOrders.length > 0) {
    y = checkPageBreak(doc, y, 60);
    y = addSectionTitle(doc, 'Histórico de Ordens de Serviço', y);
    
    y = addTable(
      doc,
      ['Data', 'OS', 'Veículo', 'Status', 'Valor'],
      data.workOrders.map(wo => [
        formatDate(wo.created_at),
        `#${wo.id.slice(0, 8).toUpperCase()}`,
        wo.vehicle_plate,
        workflowStepLabels[wo.workflow_step] || wo.workflow_step,
        wo.total_amount ? formatCurrency(wo.total_amount) : '-',
      ]),
      y,
      {
        columnStyles: {
          0: { cellWidth: 28 },
          1: { cellWidth: 30 },
          2: { cellWidth: 25 },
          3: { cellWidth: 55 },
          4: { cellWidth: 35, halign: 'right' },
        },
        bodyStyles: {
          fontSize: 8,
        },
      }
    );
  }
  
  // Payments history
  if (data.payments.length > 0) {
    y = checkPageBreak(doc, y, 60);
    y = addSectionTitle(doc, 'Histórico de Pagamentos', y);
    
    y = addTable(
      doc,
      ['Data', 'Forma de Pagamento', 'Valor'],
      data.payments.map(p => [
        formatDate(p.paid_at),
        paymentMethodLabels[p.payment_method] || p.payment_method,
        formatCurrency(p.amount),
      ]),
      y,
      {
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 70 },
          2: { cellWidth: 65, halign: 'right' },
        },
      }
    );
    
    // Payments total
    const paymentsTotal = data.payments.reduce((sum, p) => sum + p.amount, 0);
    y += 5;
    y = addTotalRow(doc, 'TOTAL PAGO', formatCurrency(paymentsTotal), y);
  }
  
  // Footer
  addFooter(doc, 1);
  
  // Download
  const customerNameSlug = data.customer.full_name.replace(/\s+/g, '_').substring(0, 30);
  downloadPDF(doc, `Historico_Cliente_${customerNameSlug}_${formatDate(new Date().toISOString()).replace(/\//g, '-')}`);
}
