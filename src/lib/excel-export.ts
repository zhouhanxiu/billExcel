'use client';

import * as XLSX from 'xlsx';
import { Waybill } from '@/types';

export function exportToExcel(data: Waybill[], filename: string = '运单导出'): void {
  const headers = [
    '外部编码',
    '发件人姓名',
    '发件人电话',
    '发件人地址',
    '收件人姓名',
    '收件人电话',
    '收件人地址',
    '重量(kg)',
    '件数',
    '温层',
    '备注',
  ];

  const rows = data.map(item => [
    item.externalCode || '',
    item.senderName,
    item.senderPhone,
    item.senderAddress,
    item.receiverName,
    item.receiverPhone,
    item.receiverAddress,
    item.weight,
    item.quantity,
    item.tempZone,
    item.note || '',
  ]);

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // 设置列宽
  ws['!cols'] = [
    { wch: 15 }, // 外部编码
    { wch: 10 }, // 发件人姓名
    { wch: 15 }, // 发件人电话
    { wch: 30 }, // 发件人地址
    { wch: 10 }, // 收件人姓名
    { wch: 15 }, // 收件人电话
    { wch: 30 }, // 收件人地址
    { wch: 10 }, // 重量
    { wch: 8 },  // 件数
    { wch: 8 },  // 温层
    { wch: 20 }, // 备注
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '运单数据');
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}
