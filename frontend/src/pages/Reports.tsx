import { useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Download, ChevronLeft, FileText, Package, DollarSign, Calendar, Info, CheckCircle, Printer, Share2, MapPin } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Installment, type Sale } from '../db/db';
import { api } from '../services/api';
import { useEffect } from 'react';
import Modal from '../components/Modal';
import { maskCurrency, parseCurrency } from '../utils/masks';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  var R = 6371;
  var dLat = deg2rad(lat2-lat1);
  var dLon = deg2rad(lon2-lon1); 
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}
function deg2rad(deg: number) { return deg * (Math.PI/180); }

async function geocodeAddress(addrStr: string) {
   try {
     const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addrStr)}&format=json&limit=1`);
     const data = await res.json();
     if (data && data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
   } catch(e) {}
   return null;
}

export default function Reports() {
  const [reportType, setReportType] = useState<null | 'dashboard' | 'sales' | 'inventory' | 'receivables' | 'received'>(null);

  const generatePDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    const title = reportType === 'dashboard' ? 'Resumo Financeiro (Geral)' : 
             reportType === 'sales' ? 'Extrato de Vendas' : 
             reportType === 'receivables' ? 'Relatório de Contas a Receber' : 
             reportType === 'received' ? 'Relatório de Contas Recebidas' : 
             'Posição de Estoque';
    
    doc.setFontSize(16);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 26);

    const table = document.getElementById('report-table') as HTMLTableElement;
    if (!table) {
      doc.text("Nenhuma tabela detalhada disponível para este filtro.", 14, 45);
      doc.save(`relatorio_vazio.pdf`);
      return;
    }

    if (reportType === 'receivables') {
      const rowElements = Array.from(table.querySelectorAll('tbody tr'));
      const instIds = rowElements.map(tr => Number(tr.getAttribute('data-id'))).filter(i => !isNaN(i) && i > 0);
      
      if (instIds.length === 0) {
        doc.text("Sem parcelas registradas na tabela para exibir.", 14, 40);
        doc.save(`relatorio_${reportType}.pdf`);
        return;
      }

      const [instRes, salesRes, cusRes] = await Promise.all([
        api.get('/installments'),
        api.get('/sales'),
        api.get('/customers')
      ]);
      const installments = instRes.data.filter((i: any) => instIds.includes(i.id));
      const salesArr = salesRes.data;
      const cusArr = cusRes.data;

      const formatAddress = (cus: any) => {
        const addr = cus?.address || cus;
        if (!addr || (!addr.street && !addr.city && !addr.neighborhood)) return 'S/ Endereço';
        return `${addr.street||''}, ${addr.number||''} - ${addr.neighborhood||''} | ${addr.city||''}/${addr.state||''}`;
      };

      let sumOriginal = 0;
      let sumJurosMulta = 0;
      let sumTotal = 0;

      const bodyData = installments.map((inst: any) => {
        const sale = salesArr.find((s: any) => s.id === inst.saleId);
        const cus = cusArr.find((c: any) => c.id === inst.customerId);
        const items = sale?.items || [];
        const qty = items.reduce((sum: any, item: any) => sum + item.quantity, 0);
        
        let juros = 0, multa = 0;
        const now = new Date();
        const due = new Date(inst.due_date);
        
        if (inst.status === 'pending' && now > due && now.toISOString().split('T')[0] !== due.toISOString().split('T')[0]) {
           const dias = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
           if (dias > 0) {
             multa = inst.amount * 0.02;
             juros = inst.amount * (0.01 / 30) * dias; 
           }
        }
        
        const saleDateStr = sale?.date ? new Date(sale.date).toLocaleDateString('pt-BR') : '';
        const dueDateStr = due.toLocaleDateString('pt-BR');
        
        const totalInst = inst.amount + multa + juros;
        sumOriginal += inst.amount;
        sumJurosMulta += (multa + juros);
        sumTotal += totalInst;
        
        return [
          `Venda: #${sale?.id||''}\nDa: ${saleDateStr}`,
          `${cus?.name||''}\nWP: ${cus?.phone||''}\nEnd: ${formatAddress(cus)}\nObs: ${cus?.observation || cus?.address?.observation || ''}`,
          `${inst.productName}\nQtd Itens: ${qty}`,
          `V ${dueDateStr}`,
          `Pr: R$ ${inst.amount.toFixed(2).replace('.',',')}\nJ/M: R$ ${(multa+juros).toFixed(2).replace('.',',')}\nTot: R$ ${totalInst.toFixed(2).replace('.',',')}`
        ];
      });

      autoTable(doc, {
        head: [['Registro', 'Informações do Cliente', 'Descr.', 'Venc.', 'Fechamento']],
        body: bodyData,
        startY: 32,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' }, 
        headStyles: { fillColor: [79, 70, 229] },
        columnStyles: {
           0: { cellWidth: 25 },
           1: { cellWidth: 70 },
           2: { cellWidth: 35 },
           // 3 Venciment
           4: { cellWidth: 32 }
        }
      });
      
      const finalY = (doc as any).lastAutoTable.finalY || 40;
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0); // Preto
      doc.text(`Resumo dos Totais (${bodyData.length} Títulos Listados):`, 14, finalY + 10);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Principal: R$ ${sumOriginal.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 14, finalY + 16);
      doc.text(`Juros + Multas: R$ ${sumJurosMulta.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 60, finalY + 16);
      
      doc.setFontSize(12);
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "bold");
      doc.text(`Valor Final a Receber: R$ ${sumTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 120, finalY + 16);
      doc.setFont("helvetica", "normal"); // Restaura

      doc.save(`relatorio_${reportType}_${new Date().getTime()}.pdf`);
      return;
    }

    const thElements = Array.from(table.querySelectorAll('th'));
    const headers = thElements.map(th => th.innerText || th.textContent || '').filter(t => t !== 'Ações');
    const actionIndex = thElements.findIndex(th => (th.innerText || th.textContent || '') === 'Ações');
    
    const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
    const data = bodyRows.map(tr => {
      const cells = Array.from(tr.querySelectorAll('td'));
      if (cells.length <= 1) return null; 
      return cells.map((td, i) => i === actionIndex ? null : (td.innerText || td.textContent || '')).filter(c => c !== null);
    }).filter(row => row !== null);

    autoTable(doc, {
      head: [headers],
      body: data as string[][],
      startY: 40,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`relatorio_${reportType}_${new Date().getTime()}.pdf`);
  };

  const generateExcel = () => {
    const table = document.getElementById('report-table') as HTMLTableElement;
    if (!table) {
      alert("Nenhuma tabela detalhada disponível para exportar.");
      return;
    }
    const wb = XLSX.utils.table_to_book(table, { sheet: "Relatorio" });
    XLSX.writeFile(wb, `relatorio_${reportType || 'vendas'}.xlsx`);
  };

  if (!reportType) {
    return (
      <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
        <div className="page-header" style={{ marginBottom: '2rem' }}>
          <h1 className="page-title">Central de Relatórios</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Selecione o tipo de relatório que deseja visualizar ou exportar.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          
          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '4px solid var(--primary)' }} onClick={() => setReportType('dashboard')}>
            <div style={{ background: 'rgba(99, 102, 241, 0.1)', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={24} className="text-primary" />
            </div>
            <h3 style={{ fontSize: '1.3rem', margin: 0 }}>Resumo Financeiro</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Visão geral de Entradas, Saídas e Fiados no período selecionado (Dashboard).</p>
          </div>

          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '4px solid var(--success)' }} onClick={() => setReportType('sales')}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={24} className="text-success" />
            </div>
            <h3 style={{ fontSize: '1.3rem', margin: 0 }}>Extrato de Vendas</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Detalhamento em lista de todas as vendas processadas no caixa da loja.</p>
          </div>

          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '4px solid var(--warning)', transition: 'transform 0.2s' }} onClick={() => setReportType('inventory')}>
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={24} className="text-warning" />
            </div>
            <h3 style={{ fontSize: '1.3rem', margin: 0 }}>Posição de Estoque</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Acompanhe os níveis de estoque e o capital físico empatado na loja.</p>
          </div>

          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '4px solid var(--danger)', transition: 'transform 0.2s' }} onClick={() => setReportType('receivables')}>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingDown size={24} className="text-danger" />
            </div>
            <h3 style={{ fontSize: '1.3rem', margin: 0 }}>Contas a Receber</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Relação completa de todos os fiados pendentes de recebimento (Dívidas na rua).</p>
          </div>

          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '4px solid var(--success)' }} onClick={() => setReportType('received')}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={24} className="text-success" />
            </div>
            <h3 style={{ fontSize: '1.3rem', margin: 0 }}>Histórico de Recebimentos</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Relatório de parcelas que já foram quitadas retroativamente, indicando as métricas de caixa.</p>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button className="btn-icon" onClick={() => setReportType(null)} style={{ background: 'var(--glass-bg)', padding: '0.75rem' }}>
          <ChevronLeft size={24} />
        </button>
        <div>
          <h2 style={{ fontSize: '1.8rem', margin: 0 }}>
            {reportType === 'dashboard' ? 'Resumo Financeiro (Geral)' : 
             reportType === 'sales' ? 'Extrato de Vendas' : 
             reportType === 'receivables' ? 'Relatório de Contas a Receber' : 
             reportType === 'received' ? 'Relatório de Contas Recebidas' : 
             'Posição de Estoque'}
          </h2>
        </div>
        
      </div>

      {reportType === 'dashboard' && <DashboardReport />}
      {reportType === 'sales' && <SalesReport onExportPDF={generatePDF} onExportExcel={generateExcel} />}
      {reportType === 'inventory' && <InventoryReport />}
      {reportType === 'receivables' && <ReceivablesReport />}
      {reportType === 'received' && <ReceivedReport />}

      {reportType !== null && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', marginBottom: '2rem' }}>
          <button className="btn-secondary" style={{ padding: '0.8rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px' }} onClick={generatePDF}>
            <Printer size={20} /> <span style={{ fontWeight: 600 }}>Imprimir Relatório</span>
          </button>
          <button className="btn-secondary" style={{ padding: '0.8rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px' }} onClick={async () => {
             if (navigator.share) {
               try { await navigator.share({ title: 'Relatório - Gestão Offline', url: window.location.href }); } catch (e) {}
             } else {
               alert('Compartilhamento não suportado nativamente. Use a tecla de Imprimir ou Salvar PDF.');
             }
          }}>
            <Share2 size={20} /> <span style={{ fontWeight: 600 }}>Compartilhar</span>
          </button>
        </div>
      )}
    </div>
  );
}

function DashboardReport() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('month');

  const [sales, setSales] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([api.get('/sales'), api.get('/payments')]).then(([s, p]) => {
      setSales(s.data);
      setPayments(p.data);
    }).catch(console.error);
  }, []);

  const now = new Date();
  const filterDate = (date: Date) => {
    const d = new Date(date);
    if (period === 'today') return d.toDateString() === now.toDateString();
    if (period === 'week') {
      const pastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= pastWeek;
    }
    if (period === 'month') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const filteredSales = sales.filter(s => filterDate(s.date));
  const filteredPayments = payments.filter(p => filterDate(p.date));

  const salesCash = filteredSales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.totalAmount, 0);
  const salesCredit = filteredSales.filter(s => s.paymentMethod === 'credit').reduce((sum, s) => sum + s.totalAmount, 0);
  const totalSales = salesCash + salesCredit;

  const totalPaymentsReceived = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-panel" style={{ padding: '0.5rem', display: 'inline-flex', gap: '0.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', alignSelf: 'flex-start' }}>
        <button className={`pill ${period === 'today' ? 'active' : ''}`} onClick={() => setPeriod('today')} style={{ border: 'none', background: period === 'today' ? 'var(--primary)' : 'transparent', padding: '0.5rem 1.5rem', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: period === 'today' ? 600 : 400 }}>Hoje</button>
        <button className={`pill ${period === 'week' ? 'active' : ''}`} onClick={() => setPeriod('week')} style={{ border: 'none', background: period === 'week' ? 'var(--primary)' : 'transparent', padding: '0.5rem 1.5rem', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: period === 'week' ? 600 : 400 }}>7 Dias</button>
        <button className={`pill ${period === 'month' ? 'active' : ''}`} onClick={() => setPeriod('month')} style={{ border: 'none', background: period === 'month' ? 'var(--primary)' : 'transparent', padding: '0.5rem 1.5rem', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: period === 'month' ? 600 : 400 }}>Mês Atual</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '4px solid var(--success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600 }}>Total de Vendas (Geral)</span>
            <TrendingUp size={20} className="text-success" />
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'white' }}>R$ {totalSales.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
          <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>Bruto Gerado no período</span>
        </div>

        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600 }}>Entrou em Caixa (Din/Pix/Card)</span>
            <DollarSign size={20} className="text-primary" />
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'white' }}>R$ {(salesCash + totalPaymentsReceived).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
          <span style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>{salesCash > 0 ? `Venda à Vista Inicial: R$ ${salesCash.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 'Nenhuma Venda Direta'}</span>
        </div>

        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '4px solid var(--warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600 }}>Foi pro Fiado (Lançado R$)</span>
            <TrendingDown size={20} className="text-warning" />
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--warning)' }}>R$ {salesCredit.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Vendas marcadas a Prazo (Não contabiliza recebimentos do mês)</span>
        </div>
      </div>

      <table id="report-table" style={{ display: 'none' }}>
        <thead>
          <tr>
            <th>Métrica (Resumo Financeiro)</th>
            <th>Valor Apurado</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Total de Vendas (Geral)</td>
            <td>R$ {totalSales.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
          </tr>
          <tr>
            <td>Entrou em Caixa (Dinheiro/Pix/Cartão)</td>
            <td>R$ {(salesCash + totalPaymentsReceived).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
          </tr>
          <tr>
            <td>Foi pro Fiado (Lançado a Prazo)</td>
            <td>R$ {salesCredit.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SalesReport({ onExportPDF, onExportExcel }: { onExportPDF?: () => void, onExportExcel?: () => void }) {
  const [sales, setSales] = useState<any[]>([]);
  useEffect(() => {
    api.get('/sales').then(res => {
      const sorted = [...res.data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSales(sorted);
    }).catch(console.error);
  }, []);

  const totalSalesValue = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  
  return (
    <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={20} className="text-success" />
          Últimas Vendas
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary" onClick={onExportPDF} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '8px' }}>
            <FileText size={16} /> Exportar PDF
          </button>
          <button className="btn-secondary" onClick={onExportExcel} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '8px' }}>
            <Download size={16} /> Exportar Excel
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table id="report-table" className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cód.</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Data da Venda</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Método</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Status Original</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Valor Total</th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma venda registrada ainda.</td></tr>
            )}
            {sales.slice(0, 100).map(sale => (
              <tr key={sale.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td data-label="Código" style={{ padding: '1rem', color: 'var(--primary)' }}>#{sale.id}</td>
                <td data-label="Data da Venda" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={14} className="text-muted" /> {new Date(sale.date).toLocaleString()}
                </td>
                <td data-label="Método" style={{ padding: '1rem', textTransform: 'capitalize' }}>{sale.paymentMethod === 'cash' ? 'Vista/Din/Pix' : 'Fiado/Cartão'}</td>
                <td data-label="Status Original" style={{ padding: '1rem' }}>
                  {sale.status === 'paid' ? (
                    <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>Pago</span>
                  ) : (
                    <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>Pendente (A Prazo)</span>
                  )}
                </td>
                <td data-label="Valor Total" style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>R$ {sale.totalAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              </tr>
            ))}
            {sales.length > 0 && (
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                <td colSpan={4} style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold' }}>TOTAL GERAL:</td>
                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--success)' }}>
                  R$ {totalSalesValue.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InventoryReport() {
  const [products, setProducts] = useState<any[]>([]);
  useEffect(() => {
    api.get('/products').then(res => setProducts(res.data)).catch(console.error);
  }, []);
  
  const totalStockItems = products.reduce((sum, p) => sum + (p.stock > 0 ? p.stock : 0), 0);
  const totalStockCost = products.reduce((sum, p) => sum + ((p.cost || 0) * (p.stock > 0 ? p.stock : 0)), 0);
  const totalStockSale = products.reduce((sum, p) => sum + (p.price_cash * (p.stock > 0 ? p.stock : 0)), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px', borderLeft: '4px solid var(--text-muted)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>Qtd. de Itens Armazenados</span>
          <span style={{ fontSize: '2rem', fontWeight: 800 }}>{totalStockItems}</span><span style={{ fontSize: '0.85rem', marginLeft: '0.5rem', color: 'var(--text-muted)' }}>unidades</span>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px', borderLeft: '4px solid var(--danger)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>Valor de Custo (Dinheiro Imobilizado)</span>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--danger)' }}>R$ {totalStockCost.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px', borderLeft: '4px solid var(--success)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>Valor Potencial de Venda Bruta</span>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--success)' }}>R$ {totalStockSale.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px' }}>
        <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Package size={20} className="text-warning" />
          Produtos em Alerta (Baixo Estoque)
        </h3>
        
        <div style={{ display: 'grid', gap: '1rem' }}>
          {products.filter(p => p.stock <= 5).map(prod => (
            <div key={prod.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: prod.stock <= 0 ? '4px solid var(--danger)' : '4px solid var(--warning)' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '1.1rem' }}>{prod.name}</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Cód: {prod.barcode || 'S/N'}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Estoque Atual</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: prod.stock <= 0 ? 'var(--danger)' : 'var(--warning)' }}>{prod.stock} un</div>
              </div>
            </div>
          ))}
          {products.filter(p => p.stock <= 5).length === 0 && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>Nenhum produto em nível crítico de estoque.</p>
          )}
        </div>
      </div>

      <table id="report-table" style={{ display: 'none' }}>
        <thead>
          <tr>
            <th>Cód. / Código de Barras</th>
            <th>Produto</th>
            <th>Estoque Atual</th>
            <th>Valor de Venda</th>
            <th>Custo Unitário</th>
          </tr>
        </thead>
        <tbody>
          {products.map(prod => (
            <tr key={prod.id}>
              <td>{prod.barcode || 'S/N'}</td>
              <td>{prod.name}</td>
              <td>{prod.stock} un</td>
              <td>R$ {prod.price_cash.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
              <td>R$ {(prod.cost || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
            </tr>
          ))}
          <tr>
            <td>RESUMO GERAL</td>
            <td>-</td>
            <td>Total Itens: {totalStockItems} un</td>
            <td>Total Venda: R$ {totalStockSale.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
            <td>Total Custo: R$ {totalStockCost.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ReceivablesReport() {
  const [filterStatus, setFilterStatus] = useState<'todos' | 'atrasado' | 'atrasado_hoje' | 'a_vencer' | 'espera' | 'serasa'>('atrasado_hoje');
  const [dateFilterType, setDateFilterType] = useState<'nenhuma' | 'dia_unico' | 'entre_datas'>('nenhuma');
  const [singleDate, setSingleDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortMethod, setSortMethod] = useState<'date' | 'location'>('date');
  const [isSortingLocation, setIsSortingLocation] = useState(false);

  // Estados de Modais
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);
  const [installmentSale, setInstallmentSale] = useState<Sale | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [autoDiscount, setAutoDiscount] = useState<number>(0);
  const [nextDueDate, setNextDueDate] = useState('');
  const [showConfirmPayment, setShowConfirmPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash'|'pix'|'card'>('cash');
  const [showSuccess, setShowSuccess] = useState(false);

  const settings = useLiveQuery(() => db.settings.toCollection().first());
  
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  
  const loadData = async () => {
    try {
      const [inst, cust] = await Promise.all([
        api.get('/installments?status=pending'),
        api.get('/customers')
      ]);
      setInstallments(inst.data);
      setCustomers(cust.data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    loadData();
  }, []);
  
  const customerMap = new Map(customers.map(c => [c.id, c.name]));
  
  const today = new Date();
  today.setHours(0,0,0,0);

  const filteredInstallments = installments.filter(inst => {
     const dueDate = new Date(inst.due_date);
     dueDate.setHours(0,0,0,0);
     const isOverdue = dueDate < today;
     const isToday = dueDate.getTime() === today.getTime();
     const isFuture = dueDate > today;
     
     const customer = customers.find(c => c.id === inst.customerId);
     const isEspera = customer?.status === 'espera';
     const isSerasa = customer?.status === 'serasa' || (customer?.is_blocked && customer?.status !== 'espera');

     if (filterStatus === 'atrasado' && !isOverdue) return false;
     if (filterStatus === 'atrasado_hoje' && !(isOverdue || isToday)) return false;
     if (filterStatus === 'a_vencer' && !isFuture) return false;
     if (filterStatus === 'espera' && !isEspera) return false;
     if (filterStatus === 'serasa' && !isSerasa) return false;
     
     if (dateFilterType === 'dia_unico' && singleDate) {
        if (dueDate.toISOString().split('T')[0] !== singleDate) return false;
     } else if (dateFilterType === 'entre_datas' && startDate && endDate) {
        const start = new Date(startDate); start.setHours(0,0,0,0);
        const end = new Date(endDate); end.setHours(23,59,59,999);
        if (dueDate < start || dueDate > end) return false;
     }

     return true;
  }).sort((a,b) => {
     if (sortMethod === 'location' && settings?.address?.lat) {
        const cusA = customers.find(c => c.id === a.customerId);
        const cusB = customers.find(c => c.id === b.customerId);
        let distA = 999999;
        let distB = 999999;
        if (cusA?.lat) distA = getDistanceFromLatLonInKm(settings.address.lat, settings.address.lng!, cusA.lat, cusA.lng!);
        if (cusB?.lat) distB = getDistanceFromLatLonInKm(settings.address.lat, settings.address.lng!, cusB.lat, cusB.lng!);
        return distA - distB;
     }
     return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  const totalReceivable = filteredInstallments.reduce((sum, inc) => sum + inc.amount, 0);

  const calculateDelay = (dueDate: Date) => {
    const todayNum = new Date().setHours(0,0,0,0);
    const dueNum = new Date(dueDate).setHours(0,0,0,0);
    const diffDays = Math.ceil((todayNum - dueNum) / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const openDetails = async (installment: Installment) => {
    setSelectedInstallment(installment);
    try {
      const res = await api.get('/sales');
      const sale = res.data.find((s: any) => s.id === installment.saleId);
      setInstallmentSale(sale || null);
    } catch (e) { console.error(e); }
    setIsDetailsModalOpen(true);
  };

  const openPayment = (installment: Installment) => {
    setSelectedInstallment(installment);

    let calcAutoDiscount = 0;
    if (settings?.punctuality_discount_active) {
       const todayNum = new Date().setHours(0,0,0,0);
       const dueNum = new Date(installment.due_date).setHours(0,0,0,0);
       if (todayNum <= dueNum) {
          calcAutoDiscount = installment.amount * ((settings.punctuality_discount_percent || 0) / 100);
       }
    }
    setAutoDiscount(calcAutoDiscount);
    setDiscountAmount(calcAutoDiscount);

    setPaymentAmount(installment.amount - calcAutoDiscount);
    setNextDueDate('');
    setIsPaymentModalOpen(true);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstallment || !selectedInstallment.id) return;
    const customer = customers.find(c => c.id === selectedInstallment.customerId);
    if (!customer || !customer.id) return;
    
    const finalExpected = selectedInstallment.amount - discountAmount;

    if (paymentAmount <= 0 && finalExpected > 0) return alert('Valor inválido.');
    if (paymentAmount > finalExpected) return alert('Valor maior que o saldo com desconto.');

    const isPartial = paymentAmount < finalExpected;
    if (isPartial && !nextDueDate) return alert('Informe data para o resto parcial.');

    setShowConfirmPayment(true);
  };

  const executePayment = async () => {
    if (!selectedInstallment || !selectedInstallment.id) return;
    const customer = customers.find(c => c.id === selectedInstallment.customerId);
    if (!customer || !customer.id) return;
    
    const finalExpected = selectedInstallment.amount - discountAmount;
    const isPartial = paymentAmount < finalExpected;

    try {
      if (!isPartial) {
        await api.put(`/installments/${selectedInstallment.id}`, { status: 'paid' });
      } else {
        const [y, m, d] = nextDueDate.split('-');
        const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
        await api.put(`/installments/${selectedInstallment.id}`, {
          amount: finalExpected - paymentAmount,
          due_date: dateObj
        });
      }

      if (paymentAmount > 0) {
        await api.post('/payments', {
          customerId: customer.id,
          amount: paymentAmount,
          method: paymentMethod,
          date: new Date()
        });
      }

      const newCreditUsed = customer.credit_used - (paymentAmount + discountAmount);
      await api.put(`/customers/${customer.id}`, {
        credit_used: Math.max(0, newCreditUsed)
      });

      setIsPaymentModalOpen(false);
      setShowConfirmPayment(false);
      setShowSuccess(true);
      await loadData();
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Erro interno ao baixar.');
    }
  };

  const handleSortByLocation = async () => {
    setIsSortingLocation(true);
    try {
      let storeLat = settings?.address?.lat;
      let storeLng = settings?.address?.lng;
      
      if (!storeLat || !storeLng) {
         if (!settings?.address?.street || !settings?.address?.city) {
            alert("Endereço da loja incompleto. Configure o endereço (Rua e Cidade) em Configurações.");
            setIsSortingLocation(false); return;
         }
         const addrStr = `${settings.address.street}, ${settings.address.number || ''}, ${settings.address.city}, Brasil`;
         const coords = await geocodeAddress(addrStr);
         if (coords) {
           storeLat = coords.lat; storeLng = coords.lng;
           await db.settings.update(settings.id!, { address: { ...settings.address, lat: storeLat, lng: storeLng } });
         }
      }
      if (!storeLat) {
        alert("Não foi possível localizar o endereço da loja via satélite. Tente detalhar mais em Configurações.");
        setIsSortingLocation(false); return;
      }

      const updatedCustomers = [...customers];
      for (let inst of filteredInstallments) {
         const cus = updatedCustomers.find(c => c.id === inst.customerId);
         if (cus && (!cus.lat || !cus.lng)) {
            if (cus.street && cus.city) {
              const addrStr = `${cus.street}, ${cus.number || ''}, ${cus.city}, Brasil`;
              const coords = await geocodeAddress(addrStr);
              if (coords) {
                 cus.lat = coords.lat; cus.lng = coords.lng;
                 await api.put(`/customers/${cus.id}`, { lat: coords.lat, lng: coords.lng }).catch(() => {});
              }
            }
            await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit 1 req/sec for Nominatim
         }
      }
      setCustomers(updatedCustomers);
      setSortMethod('location');
    } catch (e) {
      alert("Erro ao ordenar por localização.");
    } finally {
      setIsSortingLocation(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
         <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)' }}>Filtros do Relatório</h4>
         <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
               <strong style={{ display: 'block', marginBottom: '0.8rem', fontSize: '0.9rem' }}>Status da Parcela / Cliente:</strong>
               <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.95rem' }}>
                 <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                   <input type="radio" checked={filterStatus === 'todos'} onChange={() => setFilterStatus('todos')} /> Todos
                 </label>
                 <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                   <input type="radio" checked={filterStatus === 'atrasado'} onChange={() => setFilterStatus('atrasado')} /> Somente Atrasados
                 </label>
                 <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                   <input type="radio" checked={filterStatus === 'atrasado_hoje'} onChange={() => setFilterStatus('atrasado_hoje')} /> Atrasados + Vencendo Hoje
                 </label>
                 <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                   <input type="radio" checked={filterStatus === 'a_vencer'} onChange={() => setFilterStatus('a_vencer')} /> Saudáveis (A Vencer)
                 </label>
                 <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                   <input type="radio" checked={filterStatus === 'espera'} onChange={() => setFilterStatus('espera')} /> Cliente em Espera
                 </label>
                 <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                   <input type="radio" checked={filterStatus === 'serasa'} onChange={() => setFilterStatus('serasa')} /> Cliente no Serasa
                 </label>
               </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
               <strong style={{ display: 'block', marginBottom: '0.8rem', fontSize: '0.9rem' }}>Período de Vencimento:</strong>
               <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center' }}>
                 <div style={{ display: 'flex', gap: '1rem', fontSize: '0.95rem' }}>
                   <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', color: dateFilterType === 'nenhuma' ? 'var(--primary)' : 'inherit' }}>
                     <input type="radio" checked={dateFilterType === 'nenhuma'} onChange={() => setDateFilterType('nenhuma')} /> Todas as Datas
                   </label>
                   <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', color: dateFilterType === 'dia_unico' ? 'var(--primary)' : 'inherit' }}>
                     <input type="radio" checked={dateFilterType === 'dia_unico'} onChange={() => { setDateFilterType('dia_unico'); setStartDate(''); setEndDate(''); }} /> Dia Único
                   </label>
                   <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', color: dateFilterType === 'entre_datas' ? 'var(--primary)' : 'inherit' }}>
                     <input type="radio" checked={dateFilterType === 'entre_datas'} onChange={() => { setDateFilterType('entre_datas'); setSingleDate(''); }} /> Entre Datas
                   </label>
                 </div>

                 {dateFilterType === 'dia_unico' && (
                   <input type="date" value={singleDate} onChange={e => setSingleDate(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                 )}

                 {dateFilterType === 'entre_datas' && (
                   <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                     <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                     <span style={{ color: 'var(--text-muted)' }}>até</span>
                     <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                   </div>
                 )}
               </div>
            </div>
         </div>
      </div>

    <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
           <TrendingDown size={20} className="text-danger" /> Resultados Consolidados
        </h3>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
           <button onClick={() => sortMethod === 'date' ? handleSortByLocation() : setSortMethod('date')} disabled={isSortingLocation} className="btn-secondary" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px' }}>
              <MapPin size={18} />
              {isSortingLocation ? 'Calculando rotas...' : (sortMethod === 'location' ? 'Restaurar Data' : 'Ordenar p/ Proximidade (GPS)')}
           </button>
           <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)', padding: '0.5rem 1rem', borderRadius: '8px' }}>{filteredInstallments.length} Títulos P/ Receber: R$ {totalReceivable.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
        </div>
      </div>
      
      <div style={{ overflowX: 'auto' }}>
        <table id="report-table" className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cód. Compra</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cliente / Devedor</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Mercadoria - Parcela</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Vencimento</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Valor Final (R$)</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredInstallments.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma pendência encontrada com os filtros atuais!</td></tr>
            )}
            {filteredInstallments.map(inst => (
              <tr key={inst.id} data-id={inst.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td data-label="Cód. Compra" style={{ padding: '1rem', color: 'var(--text-muted)' }}>#{inst.saleId}</td>
                <td data-label="Cliente" style={{ padding: '1rem', fontWeight: 600 }}>{customerMap.get(inst.customerId) || 'Cliente Excluído'}</td>
                <td data-label="Parcela" style={{ padding: '1rem', color: 'var(--text-muted)' }}>{inst.productName} ({inst.number}/{inst.total})</td>
                <td data-label="Vencimento" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: new Date(inst.due_date) < new Date(new Date().setHours(0,0,0,0)) ? 'var(--danger)' : 'var(--text-muted)' }}>
                  <Calendar size={14} style={{ opacity: 0.7 }} /> {new Date(inst.due_date).toLocaleDateString()}
                  {new Date(inst.due_date) < new Date(new Date().setHours(0,0,0,0)) && <span style={{fontSize: '0.7rem', color: 'white', background: 'var(--danger)', padding: '0.1rem 0.4rem', borderRadius: '4px'}}>Atrasado</span>}
                </td>
                <td data-label="Restante" style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: 'var(--warning)', fontSize: '1.1rem' }}>R$ {inst.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td data-label="Ações" style={{ padding: '1rem', textAlign: 'right' }}>
                  <div className="btn-group" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                     <button className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }} title="Detalhes Financeiros" onClick={() => openDetails(inst)}>
                       <Info size={16} /> Det.
                     </button>
                     <button className="btn-primary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--success)' }} title="Receber Título / Dar Baixa" onClick={() => openPayment(inst)}>
                       <DollarSign size={16} /> Rec.
                     </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

      {/* MODAL DETALHES */}
      <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title="Detalhes Financeiros Título">
        {selectedInstallment && (
          <div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                <FileText size={20} /> Resumo do Título
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Produto</span>
                  <div style={{ fontWeight: 600 }}>{selectedInstallment.productName}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>N° da Parcela</span>
                  <div style={{ fontWeight: 600 }}>{selectedInstallment.number} de {selectedInstallment.total}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Emissão</span>
                  <div style={{ fontWeight: 600 }}>{installmentSale ? new Date(installmentSale.date).toLocaleDateString() : 'Desconhecida'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Vencimento</span>
                  <div style={{ fontWeight: 600 }}>{new Date(selectedInstallment.due_date).toLocaleDateString()}</div>
                </div>
                <div>
                   <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Mora Calculada</span>
                   <div style={{ fontWeight: 600, color: calculateDelay(selectedInstallment.due_date) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                     {calculateDelay(selectedInstallment.due_date)} dias
                   </div>
                </div>
              </div>
            </div>
            <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Genuíno em Aberto:</span>
                <span>R$ {selectedInstallment.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Acréscimos (Atraso):</span>
                <span style={{ color: 'var(--warning)' }}>R$ 0,00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Desconto Autom. (Pontualidade):</span>
                <span style={{ color: 'var(--success)' }}>
                  {settings?.punctuality_discount_active && new Date().setHours(0,0,0,0) <= new Date(selectedInstallment.due_date).setHours(0,0,0,0) 
                    ? `- R$ ${(selectedInstallment.amount * ((settings.punctuality_discount_percent || 0) / 100)).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` 
                    : 'R$ 0,00'}
                </span>
              </div>
              <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '1rem 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 800 }}>
                <span>Total a Receber Lote:</span>
                <span>R$ {
                  settings?.punctuality_discount_active && new Date().setHours(0,0,0,0) <= new Date(selectedInstallment.due_date).setHours(0,0,0,0)
                  ? (selectedInstallment.amount - (selectedInstallment.amount * ((settings.punctuality_discount_percent || 0) / 100))).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})
                  : selectedInstallment.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})
                }</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontStyle: 'italic', textAlign: 'right' }}>*Módulo de multas/juros não ativo nativamente.</p>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL PAGAMENTO */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Receber Título / Baixa">
        <form onSubmit={handlePayment}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Volume da Parcela {selectedInstallment?.number}/{selectedInstallment?.total}</p>
            <h3 style={{ fontSize: '2.5rem', margin: '0.5rem 0', color: 'var(--success)' }}>
               R$ {selectedInstallment?.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </h3>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label style={{ marginBottom: '0.5rem', display: 'block', color: autoDiscount > 0 ? 'var(--success)' : 'inherit' }}>
              Desconto Concedido (R$) {autoDiscount > 0 && <strong>(Automático de Pontualidade)</strong>}
            </label>
            <input 
              type="text" 
              value={maskCurrency(discountAmount)} 
              onChange={e => {
                let val = parseCurrency(e.target.value) as number;
                if (val > (selectedInstallment?.amount || 0)) val = selectedInstallment!.amount;
                setDiscountAmount(val);
                setPaymentAmount(selectedInstallment!.amount - val);
              }} 
              style={{ fontSize: '1.2rem', padding: '0.8rem', width: '100%', borderRadius: '8px', background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
            />
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label style={{ marginBottom: '0.5rem' }}>Valor a Receber Físico (R$)</label>
            <input 
              type="text" 
              required 
              value={maskCurrency(paymentAmount)} 
              onChange={e => {
                let val = parseCurrency(e.target.value) as number;
                const finalExpected = (selectedInstallment?.amount || 0) - discountAmount;
                if (val > finalExpected) val = finalExpected;
                setPaymentAmount(val);
              }} 
              style={{ fontSize: '1.5rem', fontWeight: 700, padding: '1rem', width: '100%', borderRadius: '8px', background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
            />
            {paymentAmount < ((selectedInstallment?.amount || 0) - discountAmount) && paymentAmount > 0 && (
              <p style={{ color: 'var(--warning)', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                Restarão pendentes <strong>R$ {((selectedInstallment!.amount - discountAmount) - paymentAmount).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong> de calote/aberto parcial!
              </p>
            )}
          </div>

          {paymentAmount < ((selectedInstallment?.amount || 0) - discountAmount) && paymentAmount > 0 && (
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label style={{ color: 'var(--warning)' }}>Novo Vencimento pro Restante Parcial (Negociação)</label>
              <input 
                type="date" 
                required 
                value={nextDueDate}
                onChange={e => setNextDueDate(e.target.value)}
                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: 'var(--text-main)', marginTop: '0.5rem' }}
              />
            </div>
          )}

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label style={{ marginBottom: '0.8rem' }}>Meio Usado Pelo Cliente</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: paymentMethod === 'cash' ? 'rgba(99, 102, 241, 0.1)' : 'transparent', border: paymentMethod === 'cash' ? '1px solid var(--primary)' : '1px solid var(--border-color)', padding: '0.8rem', borderRadius: '8px', flex: 1, justifyContent: 'center' }}>
                <input type="radio" name="method2" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} style={{display:'none'}} />
                <span style={{ fontWeight: paymentMethod === 'cash' ? 600 : 400, color: paymentMethod === 'cash' ? 'var(--primary)' : 'var(--text-main)' }}>Dinheiro</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: paymentMethod === 'pix' ? 'rgba(99, 102, 241, 0.1)' : 'transparent', border: paymentMethod === 'pix' ? '1px solid var(--primary)' : '1px solid var(--border-color)', padding: '0.8rem', borderRadius: '8px', flex: 1, justifyContent: 'center' }}>
                <input type="radio" name="method2" checked={paymentMethod === 'pix'} onChange={() => setPaymentMethod('pix')} style={{display:'none'}} />
                <span style={{ fontWeight: paymentMethod === 'pix' ? 600 : 400, color: paymentMethod === 'pix' ? 'var(--primary)' : 'var(--text-main)' }}>PIX</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: paymentMethod === 'card' ? 'rgba(99, 102, 241, 0.1)' : 'transparent', border: paymentMethod === 'card' ? '1px solid var(--primary)' : '1px solid var(--border-color)', padding: '0.8rem', borderRadius: '8px', flex: 1, justifyContent: 'center' }}>
                <input type="radio" name="method2" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} style={{display:'none'}} />
                <span style={{ fontWeight: paymentMethod === 'card' ? 600 : 400, color: paymentMethod === 'card' ? 'var(--primary)' : 'var(--text-main)' }}>Cartão</span>
              </label>
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsPaymentModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'var(--success)' }}><CheckCircle size={18} /> Confirmar</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showConfirmPayment} onClose={() => setShowConfirmPayment(false)} title="Confirmar Recebimento">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0.5rem 0' }}>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>Confirmar a baixa desta parcela?</p>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <p style={{ margin: '0 0 0.5rem 0' }}><strong style={{ color: 'var(--text-muted)' }}>Valor a Receber:</strong> R$ {paymentAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
            <p style={{ margin: '0 0 0.5rem 0' }}><strong style={{ color: 'var(--text-muted)' }}>Método:</strong> {paymentMethod === 'cash' ? 'Dinheiro' : paymentMethod === 'pix' ? 'PIX' : 'Cartão'}</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowConfirmPayment(false)}>Cancelar</button>
            <button type="button" className="btn-primary" style={{ flex: 1, background: 'var(--success)' }} onClick={executePayment}>Sim, Receber</button>
          </div>
        </div>
      </Modal>

      {showSuccess && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '2rem 3rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', fontWeight: 600, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', zIndex: 10000, animation: 'fadeIn 0.3s ease-out' }}>
            <CheckCircle size={56} color="var(--success)" />
            <span style={{ fontSize: '1.3rem' }}>Baixa de parcela efetuada!</span>
          </div>
        </div>
      )}

    </div>
  )
}

function ReceivedReport() {
  const [payments, setPayments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  
  useEffect(() => {
    Promise.all([api.get('/payments'), api.get('/customers')]).then(([p, c]) => {
      const sorted = [...p.data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPayments(sorted);
      setCustomers(c.data);
    }).catch(console.error);
  }, []);
  
  const customerMap = new Map(customers.map(c => [c.id, c.name]));
  const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
           <DollarSign size={20} className="text-success" /> Histórico de Contas Recebidas
        </h3>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem 1rem', borderRadius: '8px' }}>Total Faturado: R$ {totalReceived.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
      </div>
      
      <div style={{ overflowX: 'auto' }}>
        <table id="report-table" className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Data da Baixa</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Pagador (Cliente)</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Origem do Pagamento</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Valor Baixado (R$)</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum recebimento registrado nos últimos períodos.</td></tr>
            )}
            {payments.slice(0, 300).map(pay => (
              <tr key={pay.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td data-label="Data Baixa" style={{ padding: '1rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={14} /> {new Date(pay.date).toLocaleString()}
                </td>
                <td data-label="Pagador" style={{ padding: '1rem', fontWeight: 600 }}>{customerMap.get(pay.customerId) || 'Cliente Excluído'}</td>
                <td data-label="Origem Pay" style={{ padding: '1rem', textTransform: 'capitalize' }}>
                  <span style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 500 }}>
                    {pay.method === 'cash' ? 'Dinheiro Físico' : pay.method === 'pix' ? 'Transferência PIX' : 'Cartão de Débito/Crédito'}
                  </span>
                </td>
                <td data-label="Baixado (R$)" style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, color: 'var(--success)', fontSize: '1.1rem' }}>R$ {pay.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              </tr>
            ))}
            {payments.length > 0 && (
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                <td colSpan={3} style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold' }}>TOTAL GERAL:</td>
                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--success)' }}>
                  R$ {totalReceived.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
