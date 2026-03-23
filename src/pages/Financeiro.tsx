import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { BillsPanel } from "@/components/financeiro/BillsPanel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  CreditCard,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  CalendarIcon,
} from "lucide-react";
import {
  useFinancialSummary,
  useMonthlyRevenue,
  useDailyRevenue,
  useTopServices,
  usePaymentMethodStats,
} from "@/hooks/useFinancialData";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePDFExport } from "@/hooks/usePDFExport";
import { cn } from "@/lib/utils";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const chartConfig: ChartConfig = {
  amount: {
    label: "Valor",
    color: "hsl(var(--chart-1))",
  },
  pix: {
    label: "Pix",
    color: "hsl(var(--chart-1))",
  },
  cartao: {
    label: "Cartão",
    color: "hsl(var(--chart-2))",
  },
  dinheiro: {
    label: "Dinheiro",
    color: "hsl(var(--chart-3))",
  },
  fiado: {
    label: "Fiado",
    color: "hsl(var(--chart-4))",
  },
};

function SummaryCards() {
  const { data: summary, isLoading } = useFinancialSummary();

  const monthGrowth = summary?.lastMonthRevenue
    ? ((summary.monthRevenue - summary.lastMonthRevenue) / summary.lastMonthRevenue) * 100
    : 0;

  const cards = [
    {
      title: "Faturamento Hoje",
      value: summary?.todayRevenue || 0,
      icon: DollarSign,
      variant: "default" as const,
    },
    {
      title: "Faturamento do Mês",
      value: summary?.monthRevenue || 0,
      icon: monthGrowth >= 0 ? TrendingUp : TrendingDown,
      subtitle: monthGrowth !== 0 ? `${monthGrowth >= 0 ? "+" : ""}${monthGrowth.toFixed(1)}% vs mês anterior` : undefined,
      variant: monthGrowth >= 0 ? "success" as const : "warning" as const,
    },
    {
      title: "Ticket Médio",
      value: summary?.avgTicket || 0,
      icon: Receipt,
      subtitle: `${summary?.totalOrders || 0} OS finalizadas`,
      variant: "accent" as const,
    },
    {
      title: "A Receber",
      value: summary?.pendingAmount || 0,
      icon: Wallet,
      subtitle: "OS aprovadas/em execução",
      variant: "default" as const,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`rounded-full p-2 ${
              card.variant === 'success' ? 'bg-success/10 text-success' :
              card.variant === 'warning' ? 'bg-warning/10 text-warning' :
              card.variant === 'accent' ? 'bg-accent/10 text-accent' :
              'bg-muted text-muted-foreground'
            }`}>
              <card.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : formatCurrency(card.value)}
            </div>
            {card.subtitle && (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                {card.variant === 'success' && <ArrowUpRight className="h-3 w-3 text-success" />}
                {card.variant === 'warning' && <ArrowDownRight className="h-3 w-3 text-warning" />}
                {card.subtitle}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MonthlyRevenueChart() {
  const { data: monthlyData, isLoading } = useMonthlyRevenue();

  if (isLoading || !monthlyData?.length) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        {isLoading ? "Carregando..." : "Sem dados de faturamento"}
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <BarChart data={monthlyData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => formatCurrency(Number(value))}
            />
          }
        />
        <Bar
          dataKey="amount"
          fill="hsl(var(--accent))"
          radius={[4, 4, 0, 0]}
          maxBarSize={50}
        />
      </BarChart>
    </ChartContainer>
  );
}

function DailyRevenueChart() {
  const { data: dailyData, isLoading } = useDailyRevenue();

  if (isLoading || !dailyData?.length) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        {isLoading ? "Carregando..." : "Sem dados diários"}
      </div>
    );
  }

  const formattedData = dailyData.map((d) => ({
    ...d,
    day: format(new Date(d.date), "dd", { locale: ptBR }),
  }));

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <LineChart data={formattedData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          tickFormatter={(value) => `R$ ${value.toLocaleString()}`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => formatCurrency(Number(value))}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="amount"
          stroke="hsl(var(--accent))"
          strokeWidth={2}
          dot={{ fill: "hsl(var(--accent))", strokeWidth: 0, r: 4 }}
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
      </LineChart>
    </ChartContainer>
  );
}

function PaymentMethodsChart() {
  const { data: methodData, isLoading } = usePaymentMethodStats();

  if (isLoading || !methodData?.length) {
    return (
      <div className="flex h-[250px] items-center justify-center text-muted-foreground">
        {isLoading ? "Carregando..." : "Sem pagamentos registrados"}
      </div>
    );
  }

  const total = methodData.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="flex flex-col items-center gap-4 md:flex-row">
      <ChartContainer config={chartConfig} className="h-[200px] w-[200px]">
        <PieChart>
          <Pie
            data={methodData}
            dataKey="amount"
            nameKey="method"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
          >
            {methodData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => formatCurrency(Number(value))}
              />
            }
          />
        </PieChart>
      </ChartContainer>
      <div className="flex-1 space-y-2">
        {methodData.map((item) => (
          <div key={item.method} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: item.fill }}
              />
              <span className="text-sm text-muted-foreground">{item.method}</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-medium">{formatCurrency(item.amount)}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                ({((item.amount / total) * 100).toFixed(0)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopServicesTable() {
  const { data: services, isLoading } = useTopServices();

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Carregando...</div>;
  }

  if (!services?.length) {
    return <div className="py-8 text-center text-muted-foreground">Sem serviços registrados</div>;
  }

  return (
    <div className="space-y-3">
      {services.slice(0, 5).map((service, index) => (
        <div
          key={service.description}
          className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-3"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
              {index + 1}
            </div>
            <div>
              <p className="font-medium">{service.description}</p>
              <p className="text-xs text-muted-foreground">{service.count} realizações</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-semibold">{formatCurrency(service.totalValue)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Financeiro() {
  const currentMonth = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });
  const { exportFinancialPDF } = usePDFExport();
  
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const handleExportPDF = () => {
    exportFinancialPDF(dateRange.from, dateRange.to);
  };

  const [mainTab, setMainTab] = useState("receitas");

  return (
    <AppLayout
      title="Dashboard Financeiro"
      subtitle={`Visão geral de ${currentMonth}`}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Main Tabs: Receitas vs Contas a Pagar */}
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="receitas" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Receitas
            </TabsTrigger>
            <TabsTrigger value="contas" className="gap-2">
              <Wallet className="h-4 w-4" />
              Contas a Pagar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="receitas" className="space-y-6">
            {/* Export Actions */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={{ from: dateRange.from, to: dateRange.to }}
                      onSelect={(range) => {
                        if (range?.from && range?.to) {
                          setDateRange({ from: range.from, to: range.to });
                        }
                      }}
                      locale={ptBR}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDateRange({
                    from: startOfMonth(new Date()),
                    to: endOfMonth(new Date()),
                  })}
                >
                  Mês Atual
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const lastMonth = subMonths(new Date(), 1);
                    setDateRange({
                      from: startOfMonth(lastMonth),
                      to: endOfMonth(lastMonth),
                    });
                  }}
                >
                  Mês Anterior
                </Button>
              </div>
              
              <Button onClick={handleExportPDF} className="gap-2 bg-accent hover:bg-accent/90">
                <Download className="h-4 w-4" />
                Exportar Relatório PDF
              </Button>
            </div>

            {/* Summary Cards */}
            <SummaryCards />

            {/* Charts Tabs */}
            <Tabs defaultValue="monthly" className="space-y-4">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="monthly" className="gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Mensal
                </TabsTrigger>
                <TabsTrigger value="daily" className="gap-2">
                  <BarChart className="h-4 w-4" />
                  Diário
                </TabsTrigger>
              </TabsList>

              <TabsContent value="monthly">
                <Card>
                  <CardHeader>
                    <CardTitle>Faturamento Mensal</CardTitle>
                    <CardDescription>Últimos 6 meses de faturamento</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MonthlyRevenueChart />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="daily">
                <Card>
                  <CardHeader>
                    <CardTitle>Faturamento Diário</CardTitle>
                    <CardDescription>Receitas do mês atual</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DailyRevenueChart />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Bottom Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-accent" />
                    <CardTitle>Formas de Pagamento</CardTitle>
                  </div>
                  <CardDescription>Distribuição do mês atual</CardDescription>
                </CardHeader>
                <CardContent>
                  <PaymentMethodsChart />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-accent" />
                    <CardTitle>Serviços Mais Realizados</CardTitle>
                  </div>
                  <CardDescription>Ranking por quantidade</CardDescription>
                </CardHeader>
                <CardContent>
                  <TopServicesTable />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="contas">
            <BillsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
