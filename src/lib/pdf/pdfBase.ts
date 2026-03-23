import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import logoImg from '@/assets/logo.png';

// Extend jsPDF with autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: AutoTableOptions) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

interface AutoTableOptions {
  startY?: number;
  head?: string[][];
  body?: (string | number)[][];
  theme?: 'striped' | 'grid' | 'plain';
  headStyles?: Record<string, unknown>;
  bodyStyles?: Record<string, unknown>;
  alternateRowStyles?: Record<string, unknown>;
  columnStyles?: Record<number, Record<string, unknown>>;
  margin?: { left?: number; right?: number };
  tableWidth?: 'auto' | 'wrap' | number;
  styles?: Record<string, unknown>;
  didDrawCell?: (data: unknown) => void;
}

// Brand colors
const COLORS = {
  primary: [34, 197, 94] as [number, number, number], // Green accent
  secondary: [100, 116, 139] as [number, number, number], // Slate
  text: [30, 41, 59] as [number, number, number], // Dark slate
  muted: [148, 163, 184] as [number, number, number], // Light slate
  success: [34, 197, 94] as [number, number, number],
  warning: [245, 158, 11] as [number, number, number],
  error: [239, 68, 68] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  brand: [180, 30, 30] as [number, number, number], // MA red
};

// Cache for logo image
let cachedLogoData: string | null = null;

async function loadLogoAsBase64(): Promise<string | null> {
  if (cachedLogoData) return cachedLogoData;
  try {
    const response = await fetch(logoImg);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoData = reader.result as string;
        resolve(cachedLogoData);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function createPDF(orientation: 'portrait' | 'landscape' = 'portrait'): jsPDF {
  return new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });
}

export async function addHeaderWithLogo(
  doc: jsPDF,
  title: string,
  subtitle?: string,
): Promise<number> {
  const pageWidth = doc.internal.pageSize.width;
  
  // Try to add logo
  const logoData = await loadLogoAsBase64();
  let logoEndX = 14;
  
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', 14, 8, 25, 15);
      logoEndX = 42;
    } catch {
      // Logo failed, continue without
    }
  }
  
  // Company name
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.brand);
  doc.setFont('helvetica', 'bold');
  doc.text('MD Mecânica Multimarcas', logoEndX, 16);
  
  // Company info
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.muted);
  doc.setFont('helvetica', 'normal');
  doc.text('CNPJ: 05.887.728/0001-09 • Tel: (47) 8488-9108', logoEndX, 20);
  doc.text('Rua 248, 721, Meia Praia, Itapema - SC, 88220-000', logoEndX, 23);
  
  // Horizontal line
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(14, 27, pageWidth - 14, 27);
  
  // Report title
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 37);
  
  let currentY = 42;
  
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, 14, currentY);
    currentY += 5;
  }
  
  // Generation date
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  const dateText = `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`;
  doc.text(dateText, pageWidth - 14 - doc.getTextWidth(dateText), 37);
  
  return currentY + 5;
}

export function addHeader(
  doc: jsPDF, 
  title: string, 
  subtitle?: string,
  companyName: string = 'MA Mecânica Multimarcas'
): number {
  const pageWidth = doc.internal.pageSize.width;
  
  // Company name
  doc.setFontSize(20);
  doc.setTextColor(...COLORS.brand);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, 14, 20);
  
  // Horizontal line
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(14, 25, pageWidth - 14, 25);
  
  // Report title
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.text);
  doc.text(title, 14, 35);
  
  let currentY = 40;
  
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, 14, currentY);
    currentY += 5;
  }
  
  // Generation date
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  const dateText = `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`;
  doc.text(dateText, pageWidth - 14 - doc.getTextWidth(dateText), 35);
  
  return currentY + 5;
}

export function addFooter(doc: jsPDF, pageNumber?: number): void {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  
  // Footer line
  doc.setDrawColor(...COLORS.muted);
  doc.setLineWidth(0.2);
  doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);
  
  // Footer text
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text('MA Mecânica Multimarcas • Tel: (47) 9 8866-8001 • Blumenau/SC', 14, pageHeight - 10);
  
  if (pageNumber !== undefined) {
    const pageText = `Página ${pageNumber}`;
    doc.text(pageText, pageWidth - 14 - doc.getTextWidth(pageText), pageHeight - 10);
  }
}

export function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, y);
  
  doc.setDrawColor(...COLORS.muted);
  doc.setLineWidth(0.2);
  doc.line(14, y + 2, doc.internal.pageSize.width - 14, y + 2);
  
  return y + 8;
}

export function addInfoGrid(
  doc: jsPDF, 
  data: Array<{ label: string; value: string }>,
  y: number,
  columns: number = 2
): number {
  const pageWidth = doc.internal.pageSize.width;
  const colWidth = (pageWidth - 28) / columns;
  let currentY = y;
  let col = 0;
  
  data.forEach((item, index) => {
    const x = 14 + (col * colWidth);
    
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(item.label, x, currentY);
    
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'bold');
    doc.text(item.value || '-', x, currentY + 4);
    
    col++;
    if (col >= columns) {
      col = 0;
      currentY += 12;
    }
  });
  
  if (col > 0) {
    currentY += 12;
  }
  
  return currentY;
}

export function addTable(
  doc: jsPDF,
  headers: string[],
  data: (string | number)[][],
  startY: number,
  options?: Partial<AutoTableOptions>
): number {
  doc.autoTable({
    startY,
    head: [headers],
    body: data,
    theme: 'striped',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: COLORS.text,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
    ...options,
  });
  
  return doc.lastAutoTable.finalY + 5;
}

export function addTotalRow(
  doc: jsPDF,
  label: string,
  value: string,
  y: number
): number {
  const pageWidth = doc.internal.pageSize.width;
  
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y - 4, pageWidth - 28, 10, 'F');
  
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text(label, 18, y + 2);
  
  doc.setTextColor(...COLORS.success);
  doc.text(value, pageWidth - 18, y + 2, { align: 'right' });
  
  return y + 12;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
}

export function formatDateTime(dateString: string | null): string {
  if (!dateString) return '-';
  return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function downloadPDF(doc: jsPDF, filename: string): void {
  doc.save(`${filename}.pdf`);
}

export function checkPageBreak(doc: jsPDF, currentY: number, neededSpace: number = 30): number {
  const pageHeight = doc.internal.pageSize.height;
  
  if (currentY + neededSpace > pageHeight - 20) {
    doc.addPage();
    addFooter(doc, doc.internal.pages.length - 1);
    return 20;
  }
  
  return currentY;
}
