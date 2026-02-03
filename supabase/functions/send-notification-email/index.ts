import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface NotificationEmailRequest {
  notification_type: string;
  recipient_email: string;
  recipient_name: string;
  data: {
    work_order_id?: string;
    vehicle_plate?: string;
    vehicle_info?: string;
    customer_name?: string;
    total_amount?: number;
    budget_url?: string;
  };
}

const emailTemplates: Record<string, { subject: string; getHtml: (data: NotificationEmailRequest["data"], name: string) => string }> = {
  ORCAMENTO_PENDENTE: {
    subject: "🔧 Orçamento Pronto para Aprovação",
    getHtml: (data, name) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h1 style="color: #18181b; margin: 0 0 16px 0; font-size: 24px;">Olá, ${name}!</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              O orçamento para o veículo <strong>${data.vehicle_plate || data.vehicle_info}</strong> está pronto e aguardando sua aprovação.
            </p>
            ${data.total_amount ? `
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="margin: 0; color: #71717a; font-size: 14px;">Valor Total</p>
              <p style="margin: 4px 0 0 0; color: #18181b; font-size: 28px; font-weight: bold;">
                R$ ${data.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            ` : ''}
            ${data.budget_url ? `
            <a href="${data.budget_url}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Ver Orçamento Completo
            </a>
            ` : ''}
            <p style="color: #a1a1aa; font-size: 14px; margin: 32px 0 0 0;">
              Se você não solicitou este orçamento, por favor ignore este email.
            </p>
          </div>
          <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin-top: 24px;">
            MD Mecânica - Sistema de Gestão
          </p>
        </div>
      </body>
      </html>
    `,
  },
  OS_APROVADA: {
    subject: "✅ Orçamento Aprovado - Serviço em Andamento",
    getHtml: (data, name) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="width: 64px; height: 64px; background-color: #22c55e; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;">
                <span style="font-size: 32px;">✓</span>
              </div>
            </div>
            <h1 style="color: #18181b; margin: 0 0 16px 0; font-size: 24px; text-align: center;">Orçamento Aprovado!</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
              O cliente <strong>${data.customer_name}</strong> aprovou o orçamento para o veículo <strong>${data.vehicle_plate || data.vehicle_info}</strong>.
            </p>
            <div style="background-color: #dcfce7; border-radius: 8px; padding: 16px; text-align: center;">
              <p style="margin: 0; color: #166534; font-weight: 600;">
                O serviço pode ser iniciado! 🚗
              </p>
            </div>
          </div>
          <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin-top: 24px;">
            MD Mecânica - Sistema de Gestão
          </p>
        </div>
      </body>
      </html>
    `,
  },
  CARRO_LIBERADO: {
    subject: "🚗 Veículo Pronto para Retirada!",
    getHtml: (data, name) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="font-size: 64px;">🚗</span>
            </div>
            <h1 style="color: #18181b; margin: 0 0 16px 0; font-size: 24px; text-align: center;">Seu veículo está pronto!</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
              Olá <strong>${name}</strong>, temos ótimas notícias!<br>
              O veículo <strong>${data.vehicle_plate || data.vehicle_info}</strong> já está pronto para retirada.
            </p>
            <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>📍 Horário de Funcionamento:</strong><br>
                Segunda a Sexta: 8h às 18h<br>
                Sábado: 8h às 12h
              </p>
            </div>
            <p style="color: #52525b; font-size: 14px; text-align: center;">
              Por favor, traga um documento com foto para a retirada.
            </p>
          </div>
          <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin-top: 24px;">
            MD Mecânica - Sistema de Gestão
          </p>
        </div>
      </body>
      </html>
    `,
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { notification_type, recipient_email, recipient_name, data }: NotificationEmailRequest = await req.json();

    console.log(`Sending ${notification_type} email to ${recipient_email}`);

    // Validate required fields
    if (!notification_type || !recipient_email) {
      throw new Error("Missing required fields: notification_type, recipient_email");
    }

    const template = emailTemplates[notification_type];
    if (!template) {
      console.log(`No email template for notification type: ${notification_type}`);
      return new Response(
        JSON.stringify({ success: false, message: "No email template for this notification type" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Send email via Resend
    // Note: Using Resend's test domain. Replace with your verified domain in production.
    const emailResponse = await resend.emails.send({
      from: "MD Mecânica <onboarding@resend.dev>",
      to: [recipient_email],
      subject: template.subject,
      html: template.getHtml(data, recipient_name || "Cliente"),
    });

    if (emailResponse.error) {
      console.error("Resend API error:", emailResponse.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: emailResponse.error.message,
          hint: "Verifique se a RESEND_API_KEY está correta e o domínio de email está verificado"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("Email sent successfully:", emailResponse.data);

    return new Response(
      JSON.stringify({ success: true, email_id: emailResponse.data?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending notification email:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
