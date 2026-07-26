export const generatePrintHtml = (sale: any, settings: any) => {
  const isCreditSale = sale.paymentMethod?.includes('credit') || sale.paymentMethod?.includes('fiado');
  
  let itemsHtml = sale.items.map((item: any) => {
    let valueText = '';
    if (isCreditSale && item.installments_count) {
      valueText = `${item.installments_count}x R$ ${item.installment_value.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    } else if (isCreditSale && item.product?.price_cash) {
      valueText = `À vista: R$ ${item.product.price_cash.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    } else {
      valueText = `R$ ${(item.quantity * item.price_applied).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    }
    return `
      <tr>
        <td>${item.quantity}x</td>
        <td>${item.product.name}</td>
        <td style="text-align: right">${valueText}</td>
      </tr>
    `;
  }).join('');

  let instsHtml = '';
  if (sale.installments && sale.installments.length > 0) {
    instsHtml = `
      <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>
      <p style="text-align: center; font-weight: bold;">Vencimentos / Parcelas</p>
      <table style="width: 100%; font-size: 12px; margin-top: 5px;">
        ${sale.installments.map((inst: any, idx: number) => `
          <tr>
            <td>Parcela ${idx + 1}/${sale.installments.length}</td>
            <td>${new Date(inst.due_date).toLocaleDateString('pt-BR')}</td>
            <td style="text-align: right">R$ ${inst.amount.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
          </tr>
        `).join('')}
      </table>
    `;
  }

  return `
    <html>
      <head>
        <title>Recibo</title>
        <style>
          body { font-family: monospace; padding: 20px; color: #000; background: #fff; margin: 0; font-size: 14px; }
          .container { max-width: 350px; margin: 0 auto; width: 100%; }
          table { border-collapse: collapse; width: 100%; }
          th, td { padding: 4px 0; }
          @media print {
            body { padding: 0; margin: 0; font-size: 12pt; }
            .container { max-width: 100%; margin: 0; padding: 10px; }
            table { font-size: 12pt !important; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2 style="text-align:center; margin-bottom: 5px;">${settings?.tradeName || 'RECIBO'}</h2>
          <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>
          <p>Cliente: ${sale.customer ? sale.customer.name : 'Consumidor Final'}</p>
          <p>Data: ${new Date(sale.date).toLocaleString('pt-BR')}</p>
          <p>Pedido: #${sale.id}</p>
          <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>
          <table style="font-size: 12px;">
            ${itemsHtml}
          </table>
          <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>
          <p>Método: ${isCreditSale ? 'Crediário/Cartão' : 'Dinheiro/Pix'}</p>
          <h3 style="margin: 5px 0;">TOTAL: R$ ${sale.totalAmount.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</h3>
          ${instsHtml}
        </div>
      </body>
    </html>
  `;
};

export const generateShareText = (sale: any, settings: any) => {
  const isCreditSale = sale.paymentMethod?.includes('credit') || sale.paymentMethod?.includes('fiado');
  const custName = sale.customer?.name || 'Consumidor Final';
  
  let productsText = sale.items.map((item: any) => {
    let valueText = '';
    if (isCreditSale && item.installments_count) {
      valueText = `${item.installments_count}x R$ ${item.installment_value.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    } else if (isCreditSale && item.product?.price_cash) {
      valueText = `À vista: R$ ${item.product.price_cash.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    } else {
      valueText = `R$ ${(item.quantity * item.price_applied).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    }
    return `${item.quantity}x ${item.product.name} (${valueText})`;
  }).join('\\n');

  let extraInfo = '';
  if (isCreditSale && sale.installments && sale.installments.length > 0) {
    extraInfo += '\\n\\n*Vencimentos / Parcelas:*';
    const grouped = new Map();
    sale.installments.forEach((inst: any) => {
      const dateStr = new Date(inst.due_date).toLocaleDateString('pt-BR');
      if (!grouped.has(dateStr)) {
        grouped.set(dateStr, { amount: 0, date: dateStr, dateObj: new Date(inst.due_date) });
      }
      grouped.get(dateStr).amount += inst.amount;
    });
    const sorted = Array.from(grouped.values()).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    sorted.forEach((inst, idx) => {
      extraInfo += `\\n${idx + 1}ª Parc: ${inst.date} - R$ ${inst.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    });
  }

  const storeName = settings?.tradeName || 'RECIBO';
  const storeAddress = settings?.street ? `${settings.street}, ${settings.number || 'S/N'}` : 'Endereço não informado';
  const storePhone = settings?.phone || 'Não informado';

  return `🧾 *RECIBO DE VENDA* 🧾
-----------------------------------
*${storeName}*
📍 ${storeAddress}
📱 WhatsApp: ${storePhone}
-----------------------------------
*Pedido:* #${sale.id}
*Cliente:* ${custName}
*Data:* ${new Date(sale.date).toLocaleString('pt-BR')}
*Valor Total:* R$ ${sale.totalAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
-----------------------------------
*ITENS:*
${productsText}${extraInfo}
-----------------------------------
Obrigado pela preferência!`;
};
