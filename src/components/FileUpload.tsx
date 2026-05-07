'use client';

import React, { useState, useCallback, useRef } from 'react';
import { parseExcel, saveTemplate, generateFingerprint } from '@/lib/excel-parser';
import { Waybill, FieldMapping, ValidationError } from '@/types';
import { ProgressBar } from './ProgressBar';
import { useToast } from './Toast';

interface FileUploadProps {
  onDataLoaded: (data: Waybill[], headers: string[], mappings: FieldMapping[]) => void;
  onValidationComplete: (errors: ValidationError[]) => void;
}

export function FileUpload({ onDataLoaded, onValidationComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setError('请上传 Excel 文件 (.xlsx 或 .xls)');
      showToast('error', '请上传 Excel 文件 (.xlsx 或 .xls)');
      return;
    }

    setError(null);
    setFileName(file.name);
    setIsLoading(true);
    setProgress({ current: 0, total: 100 });

    try {
      const result = await parseExcel(file, (current, total) => {
        setProgress({ current, total });
      });

      setHeaders(result.headers);
      setMappings(result.mappings);
      
      // 检查是否需要手动映射
      const requiredFields = ['senderName', 'senderPhone', 'senderAddress', 
                             'receiverName', 'receiverPhone', 'receiverAddress',
                             'weight', 'quantity', 'tempZone'];
      const matchedFields = result.mappings.map(m => m.fieldName);
      const missingRequired = requiredFields.filter(f => !matchedFields.includes(f));
      
      if (missingRequired.length > 0) {
        setShowMappingModal(true);
      }
      
      // 如果有数据，通知父组件
      if (result.data.length > 0) {
        onDataLoaded(result.data, result.headers, result.mappings);
      } else {
        setError('文件中没有找到有效数据');
        showToast('warning', '文件中没有找到有效数据');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '文件解析失败';
      setError(message);
      showToast('error', message);
    } finally {
      setIsLoading(false);
    }
  }, [onDataLoaded, showToast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleManualMapping = useCallback((newMappings: FieldMapping[]) => {
    setMappings(newMappings);
    setShowMappingModal(false);
    
    // 手动映射后保存模板
    const fingerprint = generateFingerprint(headers);
    saveTemplate(fingerprint, newMappings);
    
    showToast('success', '映射已保存，下次将自动应用');
  }, [headers, showToast]);

  const fieldOptions = [
    { name: 'externalCode', label: '外部编码' },
    { name: 'senderName', label: '发件人姓名' },
    { name: 'senderPhone', label: '发件人电话' },
    { name: 'senderAddress', label: '发件人地址' },
    { name: 'receiverName', label: '收件人姓名' },
    { name: 'receiverPhone', label: '收件人电话' },
    { name: 'receiverAddress', label: '收件人地址' },
    { name: 'weight', label: '重量(kg)' },
    { name: 'quantity', label: '件数' },
    { name: 'tempZone', label: '温层' },
    { name: 'note', label: '备注' },
  ];

  return (
    <div className="space-y-4">
      {/* 上传区域 */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
          isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        } ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleInputChange}
          className="hidden"
        />
        
        <div className="flex flex-col items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isDragging ? 'bg-blue-100' : 'bg-gray-100'
          }`}>
            <UploadIcon className={isDragging ? 'text-blue-500' : 'text-gray-400'} />
          </div>
          <div>
            <p className="text-gray-700 font-medium">
              拖拽 Excel 文件到此处，或 <span className="text-blue-600">点击选择</span>
            </p>
            <p className="text-sm text-gray-500 mt-1">支持 .xlsx 和 .xls 格式</p>
          </div>
        </div>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <ProgressBar 
            current={progress.current} 
            total={progress.total} 
            label="正在解析文件..."
          />
        </div>
      )}

      {/* 文件信息 */}
      {fileName && !isLoading && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <ExcelIcon className="text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-green-800 font-medium">{fileName}</p>
              <p className="text-sm text-green-600">文件已加载成功</p>
            </div>
            <button
              onClick={() => {
                setFileName(null);
                setHeaders([]);
                setMappings([]);
                setError(null);
              }}
              className="text-green-600 hover:text-green-800"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <ErrorIcon className="text-red-600" />
            </div>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* 手动映射模态框 */}
      {showMappingModal && (
        <MappingModal
          headers={headers}
          currentMappings={mappings}
          fieldOptions={fieldOptions}
          onConfirm={handleManualMapping}
          onCancel={() => setShowMappingModal(false)}
        />
      )}
    </div>
  );
}

// 映射模态框
interface MappingModalProps {
  headers: string[];
  currentMappings: FieldMapping[];
  fieldOptions: { name: string; label: string }[];
  onConfirm: (mappings: FieldMapping[]) => void;
  onCancel: () => void;
}

function MappingModal({ headers, currentMappings, fieldOptions, onConfirm, onCancel }: MappingModalProps) {
  const [localMappings, setLocalMappings] = useState<FieldMapping[]>(() => {
    const map = new Map(currentMappings.map(m => [m.columnIndex, m]));
    return headers.map((header, index) => 
      map.get(index) || { fieldName: '', columnIndex: index, excelColumnName: header }
    );
  });

  const handleFieldChange = (columnIndex: number, fieldName: string) => {
    setLocalMappings(prev => prev.map((m, i) => 
      i === columnIndex ? { ...m, fieldName } : m
    ));
  };

  const handleConfirm = () => {
    const validMappings = localMappings.filter(m => m.fieldName);
    onConfirm(validMappings);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-[600px] max-w-[90vw] max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b bg-orange-50">
          <h3 className="text-lg font-semibold text-orange-800">手动列映射</h3>
          <p className="text-sm text-orange-600 mt-1">
            请为每个 Excel 列选择对应的系统字段
          </p>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2">Excel 列名</th>
                <th className="text-left p-2">系统字段映射</th>
              </tr>
            </thead>
            <tbody>
              {headers.map((header, index) => {
                const mapping = localMappings[index];
                return (
                  <tr key={index} className="border-b">
                    <td className="p-2 font-medium">{header || `列 ${index + 1}`}</td>
                    <td className="p-2">
                      <select
                        value={mapping?.fieldName || ''}
                        onChange={(e) => handleFieldChange(index, e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- 不映射 --</option>
                        {fieldOptions.map(opt => (
                          <option key={opt.name} value={opt.name}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 border-t flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            确认映射
          </button>
        </div>
      </div>
    </div>
  );
}

// 图标组件
function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={`w-6 h-6 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  );
}

function ExcelIcon({ className }: { className?: string }) {
  return (
    <svg className={`w-5 h-5 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
