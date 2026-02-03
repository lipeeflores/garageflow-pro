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
  downloadPDF,
  checkPageBreak
} from './pdfBase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FinancialEntry {
  id: string;
  entry_date: string;
  entry_type: 'RECEITA' | 'DESPESA';
  amount: number;
  description: string | null;
  category: string | null;
}

interface Payment {
  id: string;
  amount: number;
  payment_method: string;
  paid_at: string | null;
  work_order_id: string;
}

interface FinancialReportData {
  startDate: Date;
  endDate: Date;
  entries: FinancialEntry[];
  payments: Payment[];
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    averageTicket: number;
    workOrdersCompleted: number;
  };
  revenueByCategory: Array<{ category: string; amount: number }>;
  paymentMethodBreakdown: Array<{ method: string; amount: number; count: number }>;
}

const paymentMethodLabels: Record<string, string> = {
  PIX: 'PIX',
  CARTAO: 'Cartão',
  DINHEIRO: 'Dinheiro',
  MARCAR: 'A Prazo',
};

export function generateFinancialPDF(data: FinancialReportData): void {
  const doc = createPDF();
  
  const periodText = `${format(data.startDate, 'dd/MM/yyyy', { locale: ptBR })} a ${format(data.endDate, 'dd/MM/yyyy', { locale: ptBR })}`;
  
  // Header
  let y = addHeader(
    doc, 
    'Relatório Financeiro',
    `Período: ${periodText}`
  );
  
  // Summary cards
  y = addSectionTitle(doc, 'Resumo do Período', y);
  
  const summaryData = [
    { label: 'Total de Receitas', value: formatCurrency(data.summary.totalRevenue) },
    { label: 'Total de Despesas', value: formatCurrency(data.summary.totalExpenses) },
    { label: 'Lucro Líquido', value: formatCurrency(data.summary.netProfit) },
    { label: 'Ticket Médio', value: formatCurrency(data.summary.averageTicket) },
    { label: 'OS Finalizadas', value: data.summary.workOrdersCompleted.toString() },
    { label: 'Margem de Lucro', value: data.summary.totalRevenue > 0 
      ? `${((data.summary.netProfit / data.summary.totalRevenue) * 100).toFixed(1)}%` 
      : '0%' 
    },
  ];
  
  y = addInfoGrid(doc, summaryData, y, 3);
  
  // Profit highlight box
  y += 5;
  const profitColor = data.summary.netProfit >= 0 ? [34, 197, 94] : [239, 68, 68];
  doc.setFillColor(...profitColor as [number, number, number]);
  doc.roundedRect(14, y, doc.internal.pageSize.width - 28, 15, 3, 3, 'F');
  
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  const profitLabel = data.summary.netProfit >= 0 ? 'LUCRO LÍQUIDO' : 'PREJUÍZO';
  doc.text(profitLabel, 20, y + 10);
  
  const profitValue = formatCurrency(Math.abs(data.summary.netProfit));
  doc.text(profitValue, doc.internal.pageSize.width - 20, y + 10, { align: 'right' });
  
  y += 25;
  
  // Payment methods breakdown
  if (data.paymentMethodBreakdown.length > 0) {
    y = checkPageBreak(doc, y, 50);
    y = addSectionTitle(doc, 'Receita por Forma de Pagamento', y);
    
    y = addTable(
      doc,
      ['Forma de Pagamento', 'Quantidade', 'Valor Total', '% do Total'],
      data.paymentMethodBreakdown.map(p => [
        paymentMethodLabels[p.method] || p.method,
        p.count.toString(),
        formatCurrency(p.amount),
        data.summary.totalRevenue > 0 
          ? `${((p.amount / data.summary.totalRevenue) * 100).toFixed(1)}%`
          : '0%',
      ]),
      y,
      {
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 40, halign: 'center' },
          2: { cellWidth: 50, halign: 'right' },
          3: { cellWidth: 35, halign: 'right' },
        },
      }
    );
  }
  
  // Revenue by category
  if (data.revenueByCategory.length > 0) {
    y = checkPageBreak(doc, y, 50);
    y = addSectionTitle(doc, 'Receita por Categoria', y);
    
    y = addTable(
      doc,
      ['Categoria', 'Valor', '% do Total'],
      data.revenueByCategory.map(c => [
        c.category || 'Sem Categoria',
        formatCurrency(c.amount),
        data.summary.totalRevenue > 0 
          ? `${((c.amount / data.summary.totalRevenue) * 100).toFixed(1)}%`
          : '0%',
      ]),
      y,
      {
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 50, halign: 'right' },
          2: { cellWidth: 35, halign: 'right' },
        },
      }
    );
  }
  
  // Recent entries
  if (data.entries.length > 0) {
    y = checkPageBreak(doc, y, 60);
    y = addSectionTitle(doc, 'Movimentações Recentes', y);
    
    const recentEntries = data.entries.slice(0, 20);
    
    y = addTable(
      doc,
      ['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor'],
      recentEntries.map(e => [
        formatDate(e.entry_date),
        e.entry_type === 'RECEITA' ? 'Receita' : 'Despesa',
        e.description || '-',
        e.category || '-',
        formatCurrency(e.amount),
      ]),
      y,
      {
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 25 },
          2: { cellWidth: 70 },
          3: { cellWidth: 35 },
          4: { cellWidth: 30, halign: 'right' },
        },
        bodyStyles: {
          fontSize: 8,
        },
      }
    );
    
    if (data.entries.length > 20) {
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Exibindo 20 de ${data.entries.length} movimentações`, 14, y);
      y += 5;
    }
  }
  
  // Recent payments
  if (data.payments.length > 0) {
    y = checkPageBreak(doc, y, 60);
    y = addSectionTitle(doc, 'Pagamentos Recebidos', y);
    
    const recentPayments = data.payments.slice(0, 15);
    
    y = addTable(
      doc,
      ['Data', 'Método', 'Valor'],
      recentPayments.map(p => [
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
  }
  
  // Footer
  addFooter(doc, 1);
  
  // Download
  const startDateStr = format(data.startDate, 'yyyy-MM-dd');
  const endDateStr = format(data.endDate, 'yyyy-MM-dd');
  downloadPDF(doc, `Relatorio_Financeiro_${startDateStr}_a_${endDateStr}`);
}
