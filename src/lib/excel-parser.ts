'use client';

import * as XLSX from 'xlsx';
import { 
  FieldMapping, 
  TemplateConfig, 
  Waybill, 
  ImportResult, 
  ValidationError,
  COLUMN_SYNONYMS,
  SYSTEM_FIELDS,
  TEMP_ZONES,
  TemplateFingerprint
} from '@/types';

// 生成模板指纹（基于列名的哈希）
export function generateFingerprint(headers: string[]): string {
  const normalized = headers.map(h => h?.toLowerCase().trim() || '').sort().join('|');
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// 标准化列名
function normalizeColumnName(name: string): string {
  return name?.toLowerCase().replace(/[_\s\uff08\uff09（）\(\)]/g, '').trim() || '';
}

// 匹配字段
function matchField(columnName: string): string | null {
  const normalized = normalizeColumnName(columnName);
  
  for (const [fieldName, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
    for (const synonym of synonyms) {
      if (normalizeColumnName(synonym) === normalized) {
        return fieldName;
      }
    }
  }
  return null;
}

// 检测表头行
export function detectHeaderRow(data: any[][]): number {
  for (let row = 0; row < Math.min(10, data.length); row++) {
    const rowData = data[row];
    let matchCount = 0;
    for (const cell of rowData) {
      if (cell && matchField(String(cell))) {
        matchCount++;
      }
    }
    if (matchCount >= 4) { // 至少匹配4个字段
      return row;
    }
  }
  return 0; // 默认第一行
}

// 自动识别字段映射
export function autoDetectMappings(headers: string[]): FieldMapping[] {
  const mappings: FieldMapping[] = [];
  
  headers.forEach((header, index) => {
    if (!header) return;
    
    const matchedField = matchField(header);
    if (matchedField) {
      mappings.push({
        fieldName: matchedField,
        columnIndex: index,
        excelColumnName: String(header),
      });
    }
  });
  
  return mappings;
}

// 从本地存储加载已保存的模板
export function loadSavedTemplates(): TemplateFingerprint[] {
  if (typeof window === 'undefined') return [];
  
  const saved = localStorage.getItem('templateFingerprints');
  return saved ? JSON.parse(saved) : [];
}

// 保存模板到本地存储
export function saveTemplate(fingerprint: string, mappings: FieldMapping[]): void {
  if (typeof window === 'undefined') return;
  
  const saved = loadSavedTemplates();
  const existing = saved.find(t => t.fingerprint === fingerprint);
  
  if (existing) {
    existing.usageCount++;
    existing.createdAt = new Date().toISOString();
  } else {
    saved.push({
      fingerprint,
      mappings: mappings.filter(m => m.fieldName),
      createdAt: new Date().toISOString(),
      usageCount: 1,
    });
  }
  
  localStorage.setItem('templateFingerprints', JSON.stringify(saved));
}

// 查找已保存的模板
export function findSavedTemplate(headers: string[]): FieldMapping[] | null {
  const fingerprint = generateFingerprint(headers);
  const saved = loadSavedTemplates();
  const matched = saved.find(t => t.fingerprint === fingerprint);
  
  return matched?.mappings || null;
}

// 解析Excel文件
export async function parseExcel(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<{ data: Waybill[]; headers: string[]; sheetName: string; headerRow: number; mappings: FieldMapping[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        
        // 选择sheet：优先选择有数据的
        let sheetName = workbook.SheetNames[0];
        let maxRows = 0;
        
        for (const name of workbook.SheetNames) {
          const sheet = workbook.Sheets[name];
          const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
          const rows = range.e.r - range.s.r + 1;
          if (rows > maxRows && name.includes('订单') || name.includes('数据') || name.includes('Import') || name.includes('Sheet')) {
            maxRows = rows;
            sheetName = name;
          }
        }
        
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        
        onProgress?.(10, 100);
        
        // 检测表头行
        const headerRow = detectHeaderRow(jsonData);
        
        // 获取表头
        const headers = jsonData[headerRow]?.map(h => String(h || '')) || [];
        
        onProgress?.(20, 100);
        
        // 尝试查找已保存的模板
        let mappings = findSavedTemplate(headers);
        
        // 如果没有已保存的模板，自动识别
        if (!mappings || mappings.length === 0) {
          mappings = autoDetectMappings(headers);
        }
        
        onProgress?.(30, 100);
        
        // 解析数据行
        const dataRows: Waybill[] = [];
        const totalRows = jsonData.length - headerRow - 1;
        
        for (let i = headerRow + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.every((cell: any) => !cell && cell !== 0)) continue;
          
          const waybill: Record<string, any> = {
            id: `temp_${i}`,
            externalCode: '',
            senderName: '',
            senderPhone: '',
            senderAddress: '',
            receiverName: '',
            receiverPhone: '',
            receiverAddress: '',
            weight: 0,
            quantity: 0,
            tempZone: '常温',
            note: '',
            status: 'pending',
          };
          
          for (const mapping of mappings) {
            const value = row[mapping.columnIndex];
            if (value !== undefined && value !== null) {
              waybill[mapping.fieldName] = typeof value === 'string' ? value.trim() : value;
            }
          }
          
          dataRows.push(waybill as Waybill);
          
          if (i % 100 === 0) {
            onProgress?.(30 + Math.floor((i / jsonData.length) * 60), 100);
          }
        }
        
        onProgress?.(95, 100);
        
        resolve({
          data: dataRows,
          headers,
          sheetName,
          headerRow,
          mappings: mappings || [],
        });
      } catch (error) {
        reject(new Error(`Excel解析失败: ${error instanceof Error ? error.message : '未知错误'}`));
      }
    };
    
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

// 校验数据
export function validateData(data: Waybill[], existingCodes: string[] = []): ValidationError[] {
  const errors: ValidationError[] = [];
  const codeCount: Record<string, number> = {};
  
  // 统计外部编码出现次数
  data.forEach((item, index) => {
    if (item.externalCode) {
      codeCount[item.externalCode] = (codeCount[item.externalCode] || 0) + 1;
    }
  });
  
  // 检查与已存在数据的重复
  existingCodes.forEach(code => {
    if (code) {
      const exists = data.some(item => item.externalCode === code);
      if (exists) {
        data.forEach((item, idx) => {
          if (item.externalCode === code) {
            errors.push({
              row: idx + 1,
              field: 'externalCode',
              fieldLabel: '外部编码',
              message: `与已存在的运单重复`,
              type: 'duplicate',
            });
          }
        });
      }
    }
  });
  
  data.forEach((item, index) => {
    const rowNum = index + 1;
    
    // 必填字段校验
    const requiredFields = ['senderName', 'senderPhone', 'senderAddress', 
                           'receiverName', 'receiverPhone', 'receiverAddress',
                           'weight', 'quantity', 'tempZone'];
    
    for (const field of requiredFields) {
      const fieldDef = SYSTEM_FIELDS.find(f => f.name === field);
      const value = item[field as keyof Waybill];
      
      if (value === undefined || value === null || value === '' || 
          (typeof value === 'number' && isNaN(value))) {
        errors.push({
          row: rowNum,
          field,
          fieldLabel: fieldDef?.label || field,
          message: '此字段为必填项',
          type: 'required',
        });
      }
    }
    
    // 电话格式校验
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (item.senderPhone && !phoneRegex.test(String(item.senderPhone))) {
      errors.push({
        row: rowNum,
        field: 'senderPhone',
        fieldLabel: '发件人电话',
        message: '格式错误，请输入11位手机号',
        type: 'format',
      });
    }
    if (item.receiverPhone && !phoneRegex.test(String(item.receiverPhone))) {
      errors.push({
        row: rowNum,
        field: 'receiverPhone',
        fieldLabel: '收件人电话',
        message: '格式错误，请输入11位手机号',
        type: 'format',
      });
    }
    
    // 重量校验（正数）
    if (item.weight !== undefined && item.weight !== null) {
      const weight = Number(item.weight);
      if (isNaN(weight) || weight <= 0) {
        errors.push({
          row: rowNum,
          field: 'weight',
          fieldLabel: '重量(kg)',
          message: '必须为正数',
          type: 'range',
        });
      }
    }
    
    // 件数校验（正整数）
    if (item.quantity !== undefined && item.quantity !== null) {
      const qty = Number(item.quantity);
      if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
        errors.push({
          row: rowNum,
          field: 'quantity',
          fieldLabel: '件数',
          message: '必须为正整数',
          type: 'range',
        });
      }
    }
    
    // 温层校验
    if (item.tempZone && !TEMP_ZONES.includes(item.tempZone as any)) {
      errors.push({
        row: rowNum,
        field: 'tempZone',
        fieldLabel: '温层',
        message: `可选值：${TEMP_ZONES.join('、')}`,
        type: 'range',
      });
    }
    
    // 外部编码重复检测（同批次内）
    if (item.externalCode && codeCount[item.externalCode] > 1) {
      const firstIndex = data.findIndex(d => d.externalCode === item.externalCode);
      errors.push({
        row: rowNum,
        field: 'externalCode',
        fieldLabel: '外部编码',
        message: `与第${firstIndex + 1}行重复`,
        type: 'duplicate',
      });
    }
  });
  
  return errors;
}

// 获取有错误的行号
export function getErrorRowNumbers(errors: ValidationError[]): Set<number> {
  return new Set(errors.map(e => e.row));
}

// 获取字段错误
export function getFieldErrors(errors: ValidationError[], row: number): ValidationError[] {
  return errors.filter(e => e.row === row);
}
