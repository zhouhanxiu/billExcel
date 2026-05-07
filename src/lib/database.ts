'use client';

import { createClient } from '@supabase/supabase-js';
import { Waybill, SubmitResult } from '@/types';

// Supabase配置 - 使用环境变量
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 创建客户端（如果配置存在）
export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// 检查数据库是否可用
export function isDatabaseAvailable(): boolean {
  return supabase !== null;
}

// 创建运单表（如果不存在）
export async function ensureTableExists(): Promise<boolean> {
  if (!supabase) return false;
  
  try {
    // 尝试插入一条记录来触发表创建
    const { error } = await supabase.from('waybills').insert({
      id: 'init_check',
      external_code: 'INIT_CHECK',
      sender_name: '初始化检查',
      sender_phone: '13800138000',
      sender_address: '测试地址',
      receiver_name: '收件人',
      receiver_phone: '13900139000',
      receiver_address: '收货地址',
      weight: 1,
      quantity: 1,
      temp_zone: '常温',
      note: '',
      status: 'pending',
    }).select();
    
    if (error) {
      console.error('表可能不存在:', error);
      return false;
    }
    
    // 删除测试记录
    await supabase.from('waybills').delete().eq('id', 'init_check');
    return true;
  } catch (e) {
    console.error('数据库检查失败:', e);
    return false;
  }
}

// 获取所有已存在的外部编码
export async function getExistingCodes(): Promise<string[]> {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from('waybills')
      .select('external_code')
      .not('external_code', 'is', null)
      .neq('external_code', '');
    
    if (error) throw error;
    return data?.map(d => d.external_code) || [];
  } catch (e) {
    console.error('获取已存在编码失败:', e);
    return [];
  }
}

// 提交运单数据
export async function submitWaybills(
  waybills: Waybill[],
  onProgress?: (current: number, total: number) => void
): Promise<SubmitResult> {
  const result: SubmitResult = {
    success: true,
    totalSubmitted: waybills.length,
    successCount: 0,
    failedCount: 0,
    errors: [],
  };
  
  if (!supabase) {
    // 如果没有数据库，使用本地存储模拟
    try {
      const saved = localStorage.getItem('waybills_local');
      const existing: Waybill[] = saved ? JSON.parse(saved) : [];
      
      for (let i = 0; i < waybills.length; i++) {
        waybills[i].status = 'submitted';
        waybills[i].submitAt = new Date().toISOString();
        onProgress?.(i + 1, waybills.length);
        await new Promise(r => setTimeout(r, 50)); // 模拟异步
      }
      
      existing.push(...waybills);
      localStorage.setItem('waybills_local', JSON.stringify(existing));
      
      result.successCount = waybills.length;
      return result;
    } catch (e) {
      result.success = false;
      result.errors.push({ row: -1, message: '本地存储失败' });
      return result;
    }
  }
  
  // 使用Supabase
  const records = waybills.map(w => ({
    id: w.id.startsWith('temp_') ? `wb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : w.id,
    external_code: w.externalCode,
    sender_name: w.senderName,
    sender_phone: w.senderPhone,
    sender_address: w.senderAddress,
    receiver_name: w.receiverName,
    receiver_phone: w.receiverPhone,
    receiver_address: w.receiverAddress,
    weight: Number(w.weight),
    quantity: Number(w.quantity),
    temp_zone: w.tempZone,
    note: w.note || '',
    status: 'submitted',
    submitted_at: new Date().toISOString(),
  }));
  
  try {
    const { data, error } = await supabase
      .from('waybills')
      .insert(records)
      .select('id');
    
    if (error) throw error;
    
    result.successCount = data?.length || 0;
    result.failedCount = waybills.length - result.successCount;
    
    // 更新本地数据状态
    waybills.forEach((w, i) => {
      if (data?.[i]) {
        w.status = 'submitted';
        w.submitAt = new Date().toISOString();
      } else {
        w.status = 'failed';
      }
    });
    
  } catch (e) {
    result.success = false;
    result.errors.push({ row: -1, message: `数据库错误: ${e instanceof Error ? e.message : '未知错误'}` });
    result.failedCount = waybills.length;
  }
  
  return result;
}

// 获取运单列表
export async function getWaybillList(
  page: number = 1,
  pageSize: number = 20,
  search?: { externalCode?: string; receiverName?: string; startDate?: string; endDate?: string }
): Promise<{ data: Waybill[]; total: number }> {
  // 如果没有数据库，使用本地存储
  if (!supabase) {
    try {
      const saved = localStorage.getItem('waybills_local');
      let data: Waybill[] = saved ? JSON.parse(saved) : [];
      
      // 搜索过滤
      if (search?.externalCode) {
        data = data.filter(w => w.externalCode?.includes(search.externalCode!));
      }
      if (search?.receiverName) {
        data = data.filter(w => w.receiverName?.includes(search.receiverName!));
      }
      if (search?.startDate) {
        data = data.filter(w => w.submitAt && w.submitAt >= search.startDate!);
      }
      if (search?.endDate) {
        data = data.filter(w => w.submitAt && w.submitAt <= search.endDate!);
      }
      
      const total = data.length;
      const start = (page - 1) * pageSize;
      data = data.slice(start, start + pageSize);
      
      return { data, total };
    } catch (e) {
      return { data: [], total: 0 };
    }
  }
  
  // 使用Supabase
  let query = supabase
    .from('waybills')
    .select('*', { count: 'exact' })
    .order('submitted_at', { ascending: false });
  
  if (search?.externalCode) {
    query = query.ilike('external_code', `%${search.externalCode}%`);
  }
  if (search?.receiverName) {
    query = query.ilike('receiver_name', `%${search.receiverName}%`);
  }
  if (search?.startDate) {
    query = query.gte('submitted_at', search.startDate);
  }
  if (search?.endDate) {
    query = query.lte('submitted_at', search.endDate + 'T23:59:59');
  }
  
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);
  
  const { data, error, count } = await query;
  
  if (error) throw error;
  
  const waybills: Waybill[] = (data || []).map(row => ({
    id: row.id,
    externalCode: row.external_code,
    senderName: row.sender_name,
    senderPhone: row.sender_phone,
    senderAddress: row.sender_address,
    receiverName: row.receiver_name,
    receiverPhone: row.receiver_phone,
    receiverAddress: row.receiver_address,
    weight: row.weight,
    quantity: row.quantity,
    tempZone: row.temp_zone,
    note: row.note || '',
    status: row.status,
    createdAt: row.created_at,
    submitAt: row.submitted_at,
  }));
  
  return { data: waybills, total: count || 0 };
}

// 删除运单
export async function deleteWaybill(id: string): Promise<boolean> {
  if (!supabase) {
    try {
      const saved = localStorage.getItem('waybills_local');
      let data: Waybill[] = saved ? JSON.parse(saved) : [];
      data = data.filter(w => w.id !== id);
      localStorage.setItem('waybills_local', JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }
  
  const { error } = await supabase.from('waybills').delete().eq('id', id);
  return !error;
}
