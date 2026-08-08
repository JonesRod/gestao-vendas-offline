import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

export async function sendWhatsAppMessage(phone: string, text: string) {
  try {
    const settings = await prisma.settings.findFirst();
    if (!settings || !settings.whatsapp_url || !settings.whatsapp_token || !settings.whatsapp_instance) {
      console.warn('[WhatsApp] Não configurado. Mensagem não enviada para:', phone);
      return false;
    }

    // A Evolution API requer DDI e DDD no número. Se não tiver DDI '55', a gente adiciona (se for BR).
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
      cleanPhone = `55${cleanPhone}`;
    }

    // A URL base não deve ter barra no final, mas por via das dúvidas:
    const baseUrl = settings.whatsapp_url.replace(/\/$/, '');
    const url = `${baseUrl}/message/sendText/${settings.whatsapp_instance}`;
    
    await axios.post(url, {
      number: cleanPhone,
      text: text
    }, {
      headers: {
        'apikey': settings.whatsapp_token,
        'Content-Type': 'application/json'
      },
      timeout: 5000 // 5 segundos de timeout para não travar o backend
    });
    
    console.log(`[WhatsApp] Mensagem enviada com sucesso para ${cleanPhone}`);
    return true;
  } catch (error: any) {
    console.error(`[WhatsApp] Erro ao enviar mensagem para ${phone}:`, error.message);
    return false;
  }
}
