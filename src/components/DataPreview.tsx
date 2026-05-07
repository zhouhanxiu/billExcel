'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Waybill, ValidationError, SYSTEM_FIELDS, TEMP_ZONES } from '@/types';
import { exportToExcel } from '@/lib/excel-export';

interface DataPreviewProps {
  data: Waybill[];
  errors: ValidationError[];
  onDataChange: (data: Waybill[]) => void;
  onErrorsChange: (errors: ValidationError[]) => void;
}

export function DataPreview({ data, errors, onDataChange, onErrorsChange }: DataPreviewProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  
  // 获取某行的所有错误
  const getRowErrors = useCallback((rowIndex: number) => {
    return errors.filter(e => e.row === rowIndex + 1);
  }, [errors]);
  
  // 获取某单元格的错误
  const getCellError = useCallback((rowIndex: number, field: string) => {
    return errors.find(e => e.row === rowIndex + 1 && e.field === field);
  }, [errors]);
  
  // 开始编辑
  const startEdit = useCallback((rowIndex: number, field: string, currentValue: any) => {
    setEditingCell({ row: rowIndex, field });
    setEditValue(currentValue === null || currentValue === undefined ? '' : String(currentValue));
  }, []);
  
  // 结束编辑
  const finishEdit = useCallback(() => {
    if (!editingCell) return;
    
    const { row, field } = editingCell;
    const newData = [...data];
    const item = { ...newData[row] };
    
    // 类型转换
    if (field === 'weight' || field === 'quantity') {
      const num = parseFloat(editValue);
      (item as Record<string, unknown>)[field] = isNaN(num) ? 0 : num;
    } else if (field === 'tempZone') {
      (item as Record<string, unknown>)[field] = editValue;
    } else {
      (item as Record<string, unknown>)[field] = editValue;
    }
    
    newData[row] = item;
    onDataChange(newData);
    setEditingCell(null);
  }, [editingCell, editValue, data, onDataChange]);
  
  // 键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!editingCell) return;
    
    if (e.key === 'Enter') {
      finishEdit();
      // 移动到下一行同一列
      const nextRow = editingCell.row + 1;
      if (nextRow < data.length) {
        const value = (data[nextRow] as unknown as Record<string, unknown>)[editingCell.field];
        setTimeout(() => startEdit(nextRow, editingCell.field, value), 50);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      finishEdit();
      // 移动到下一个字段
      const fieldNames: string[] = SYSTEM_FIELDS.map(f => f.name);
      const currentIndex = fieldNames.indexOf(editingCell.field);
      const nextIndex = (currentIndex + 1) % fieldNames.length;
      const nextField = fieldNames[nextIndex];
      const value = (data[editingCell.row] as unknown as Record<string, unknown>)[nextField];
      setTimeout(() => startEdit(editingCell.row, nextField, value), 50);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  }, [editingCell, finishEdit, startEdit, data]);
  
  // 删除行
  const deleteRow = useCallback((index: number) => {
    const newData = data.filter((_, i) => i !== index);
    onDataChange(newData);
  }, [data, onDataChange]);
  
  // 新增行
  const addRow = useCallback(() => {
    const newRow: Waybill = {
      id: `temp_new_${Date.now()}`,
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
      createdAt: new Date().toISOString(),
    };
    onDataChange([...data, newRow]);
  }, [data, onDataChange]);
  
  // 导出Excel
  const handleExport = useCallback(() => {
    exportToExcel(data, '运单预览');
  }, [data]);
  
  // 计算统计
  const stats = useMemo(() => {
    const total = data.length;
    const errorRows = new Set(errors.map(e => e.row)).size;
    return { total, errorRows, validRows: total - errorRows };
  }, [data, errors]);
  
  // 聚焦输入框
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);
  
  // 错误提示内容
  const getErrorTip = (rowIndex: number, field: string) => {
    const error = getCellError(rowIndex, field);
    if (!error) return null;
    return error.message;
  };
  
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        暂无数据，请先上传 Excel 文件
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex gap-4 text-sm">
            <span className="text-gray-600">
              共 <span className="font-semibold">{stats.total}</span> 条
            </span>
            <span className="text-green-600">
              有效 <span className="font-semibold">{stats.validRows}</span> 条
            </span>
            <span className="text-red-600">
              有误 <span className="font-semibold">{stats.errorRows}</span> 条
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={addRow}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <PlusIcon /> 添加行
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors"
          >
            <DownloadIcon /> 导出 Excel
          </button>
        </div>
      </div>
      
      {/* 表格 */}
      <div ref={tableRef} className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-3 text-left font-semibold text-gray-700 w-12">行号</th>
                {SYSTEM_FIELDS.map(field => (
                  <th
                    key={field.name}
                    className={`px-3 py-3 text-left font-semibold text-gray-700 min-w-[120px] ${
                      field.required ? 'text-red-600' : ''
                    }`}
                  >
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </th>
                ))}
                <th className="px-3 py-3 text-center font-semibold text-gray-700 w-24">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, rowIndex) => {
                const rowErrors = getRowErrors(rowIndex);
                const hasRowError = rowErrors.length > 0;
                
                return (
                  <tr 
                    key={item.id || rowIndex}
                    className={`border-t hover:bg-gray-50 ${
                      hasRowError ? 'bg-red-50' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-gray-500 text-center">{rowIndex + 1}</td>
                    {SYSTEM_FIELDS.map(field => {
                      const value = item[field.name as keyof Waybill];
                      const error = getCellError(rowIndex, field.name);
                      const isEditing = editingCell?.row === rowIndex && editingCell?.field === field.name;
                      
                      return (
                        <td 
                          key={field.name}
                          className={`px-3 py-2 relative ${
                            error ? 'bg-red-100' : ''
                          }`}
                          title={getErrorTip(rowIndex, field.name) || ''}
                        >
                          {isEditing ? (
                            field.name === 'tempZone' ? (
                              <select
                                ref={inputRef as any}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={finishEdit}
                                onKeyDown={handleKeyDown}
                                className="w-full p-1 border-2 border-blue-500 rounded focus:outline-none"
                              >
                                {TEMP_ZONES.map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                ref={inputRef}
                                type={field.name === 'weight' || field.name === 'quantity' ? 'number' : 'text'}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={finishEdit}
                                onKeyDown={handleKeyDown}
                                className="w-full p-1 border-2 border-blue-500 rounded focus:outline-none"
                              />
                            )
                          ) : (
                            <div
                              onClick={() => startEdit(rowIndex, field.name, value)}
                              className={`cursor-pointer p-1 rounded hover:bg-gray-100 ${
                                !value && field.required ? 'text-red-400' : ''
                              }`}
                            >
                              {value !== undefined && value !== null && value !== '' 
                                ? String(value) 
                                : field.required 
                                  ? <span className="text-red-400 italic">请填写</span>
                                  : <span className="text-gray-300">-</span>
                              }
                            </div>
                          )}
                          {error && (
                            <div className="absolute left-0 top-full mt-1 bg-red-500 text-white text-xs px-2 py-1 rounded shadow-lg z-20 whitespace-nowrap">
                              {error.message}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => deleteRow(rowIndex)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="删除此行"
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* 错误汇总 */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h4 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
            <ErrorIcon />
            发现 {errors.length} 个错误
          </h4>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {errors.map((error, index) => (
              <div 
                key={index}
                className="text-sm text-red-700 bg-white p-2 rounded border border-red-100"
              >
                <span className="font-medium">第{error.row}行</span>
                <span className="text-red-500 mx-1">{error.fieldLabel}</span>
                <span>：{error.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 图标组件
function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
