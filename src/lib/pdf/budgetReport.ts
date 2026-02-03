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

interface BudgetData {
  id: string;
  created_at: string;
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
  };
  items: Array<{
    description: string;
    item_type: string;
    quantity: number;
    pricing?: {
      unit_price: number;
      total_price: number;
      is_approved: boolean;
    };
  }>;
  total_amount: number;
  validity_days?: number;
  notes?: string;
}

export function generateBudgetPDF(data: BudgetData): void {
  const doc = createPDF();
  
  // Header
  let y = addHeader(
    doc, 
    'Orçamento',
    `Ref: #${data.id.slice(0, 8).toUpperCase()}`
  );
  
  // Customer info
  y = addSectionTitle(doc, 'Cliente', y);
  y = addInfoGrid(doc, [
    { label: 'Nome', value: data.customer.full_name },
    { label: 'Telefone', value: data.customer.phone_number },
    { label: 'Email', value: data.customer.email || '-' },
  ], y, 3);
  
  // Vehicle info
  y = addSectionTitle(doc, 'Veículo', y);
  y = addInfoGrid(doc, [
    { label: 'Placa', value: data.vehicle.plate },
    { label: 'Marca/Modelo', value: `${data.vehicle.make} ${data.vehicle.model}` },
    { label: 'Ano', value: data.vehicle.year?.toString() || '-' },
  ], y, 3);
  
  // Services
  const services = data.items.filter(i => i.item_type === 'SERVICE');
  if (services.length > 0) {
    y = checkPageBreak(doc, y, 50);
    y = addSectionTitle(doc, 'Serviços', y);
    
    const servicesTotal = services.reduce((sum, s) => sum + (s.pricing?.total_price || 0), 0);
    
    y = addTable(
      doc,
      ['Descrição', 'Qtd', 'Valor Unitário', 'Valor Total'],
      services.map(s => [
        s.description,
        s.quantity.toString(),
        s.pricing ? formatCurrency(s.pricing.unit_price) : '-',
        s.pricing ? formatCurrency(s.pricing.total_price) : '-',
      ]),
      y,
      {
        columnStyles: {
          0: { cellWidth: 95 },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 35, halign: 'right' },
          3: { cellWidth: 35, halign: 'right' },
        },
      }
    );
    
    // Services subtotal
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    const subtotalText = `Subtotal Serviços: ${formatCurrency(servicesTotal)}`;
    doc.text(subtotalText, doc.internal.pageSize.width - 14 - doc.getTextWidth(subtotalText), y);
    y += 10;
  }
  
  // Parts
  const parts = data.items.filter(i => i.item_type === 'PART');
  if (parts.length > 0) {
    y = checkPageBreak(doc, y, 50);
    y = addSectionTitle(doc, 'Peças', y);
    
    const partsTotal = parts.reduce((sum, p) => sum + (p.pricing?.total_price || 0), 0);
    
    y = addTable(
      doc,
      ['Descrição', 'Qtd', 'Valor Unitário', 'Valor Total'],
      parts.map(p => [
        p.description,
        p.quantity.toString(),
        p.pricing ? formatCurrency(p.pricing.unit_price) : '-',
        p.pricing ? formatCurrency(p.pricing.total_price) : '-',
      ]),
      y,
      {
        columnStyles: {
          0: { cellWidth: 95 },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 35, halign: 'right' },
          3: { cellWidth: 35, halign: 'right' },
        },
      }
    );
    
    // Parts subtotal
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    const subtotalText = `Subtotal Peças: ${formatCurrency(partsTotal)}`;
    doc.text(subtotalText, doc.internal.pageSize.width - 14 - doc.getTextWidth(subtotalText), y);
    y += 10;
  }
  
  // Total
  y = checkPageBreak(doc, y, 30);
  y += 5;
  y = addTotalRow(doc, 'VALOR TOTAL DO ORÇAMENTO', formatCurrency(data.total_amount), y);
  
  // Notes and validity
  y = checkPageBreak(doc, y, 40);
  y += 10;
  
  // Validity info
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Data de Emissão: ${formatDate(data.created_at)}`, 14, y);
  y += 5;
  doc.text(`Validade: ${data.validity_days || 15} dias a partir da emissão`, 14, y);
  y += 10;
  
  // Terms
  y = addSectionTitle(doc, 'Condições', y);
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  
  const terms = [
    '• Os valores estão sujeitos a alteração caso sejam identificados serviços adicionais durante a execução.',
    '• O prazo de execução será definido após a aprovação do orçamento.',
    '• Peças substituídas ficam à disposição do cliente por 48 horas.',
    '• Garantia de 90 dias para serviços e conforme fabricante para peças.',
  ];
  
  terms.forEach((term, index) => {
    const lines = doc.splitTextToSize(term, 180);
    doc.text(lines, 14, y);
    y += (lines.length * 4) + 2;
  });
  
  // Custom notes
  if (data.notes) {
    y = checkPageBreak(doc, y, 30);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Observações:', 14, y);
    y += 4;
    doc.setTextColor(30, 41, 59);
    const noteLines = doc.splitTextToSize(data.notes, 180);
    doc.text(noteLines, 14, y);
    y += (noteLines.length * 4) + 5;
  }
  
  // Approval section
  y = checkPageBreak(doc, y, 50);
  y += 10;
  
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  
  // Approval box
  doc.rect(14, y, doc.internal.pageSize.width - 28, 35);
  
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('APROVAÇÃO DO CLIENTE', 20, y);
  
  y += 15;
  doc.setLineWidth(0.3);
  doc.line(20, y, 100, y);
  doc.line(110, y, 190, y);
  
  y += 4;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Assinatura do Cliente', 20, y);
  doc.text('Data', 110, y);
  
  // Footer
  addFooter(doc, 1);
  
  // Download
  downloadPDF(doc, `Orcamento_${data.id.slice(0, 8).toUpperCase()}_${formatDate(data.created_at).replace(/\//g, '-')}`);
}
