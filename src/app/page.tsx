'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { DataPreview } from '@/components/DataPreview';
import { WaybillList } from '@/components/WaybillList';
import { ModalProgress } from '@/components/ProgressBar';
import { ToastProvider, useToast } from '@/components/Toast';
import { Waybill, FieldMapping, ValidationError } from '@/types';
import { validateData } from '@/lib/excel-parser';
import { submitWaybills, getExistingCodes } from '@/lib/database';

function HomePage() {
  const [activeTab, setActiveTab] = useState<'import' | 'list'>('import');
  const [data, setData] = useState<Waybill[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState({ current: 0, total: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const { showToast } = useToast();

  // 数据加载回调
  const handleDataLoaded = useCallback(async (loadedData: Waybill[], loadedHeaders: string[], loadedMappings: FieldMapping[]) => {
    setData(loadedData);
    setHeaders(loadedHeaders);
    setMappings(loadedMappings);
    
    // 获取已存在的编码进行重复检测
    const existingCodes = await getExistingCodes();
    
    // 校验数据
    const validationErrors = validateData(loadedData, existingCodes);
    setErrors(validationErrors);
    
    if (validationErrors.length > 0) {
      showToast('warning', `发现 ${validationErrors.length} 个数据问题，请检查修正`);
    } else {
      showToast('success', `成功加载 ${loadedData.length} 条数据`);
    }
  }, [showToast]);

  // 数据变更回调
  const handleDataChange = useCallback((newData: Waybill[]) => {
    setData(newData);
    
    // 重新校验
    getExistingCodes().then(existingCodes => {
      const validationErrors = validateData(newData, existingCodes);
      setErrors(validationErrors);
    });
  }, []);

  // 提交下单
  const handleSubmit = useCallback(async () => {
    // 检查是否有错误
    if (errors.length > 0) {
      showToast('error', `仍有 ${errors.length} 个错误未修正，请先修正后再提交`);
      return;
    }
    
    if (data.length === 0) {
      showToast('error', '没有可提交的数据');
      return;
    }
    
    setIsSubmitting(true);
    setSubmitProgress({ current: 0, total: data.length });
    
    try {
      const result = await submitWaybills(data, (current, total) => {
        setSubmitProgress({ current, total });
      });
      
      if (result.success) {
        showToast('success', `提交成功！成功 ${result.successCount} 条，失败 ${result.failedCount} 条`);
        // 清空数据
        setData([]);
        setErrors([]);
        // 刷新列表
        setRefreshKey(k => k + 1);
        // 切换到列表页
        setActiveTab('list');
      } else {
        showToast('error', result.errors[0]?.message || '提交失败');
      }
    } catch (e) {
      showToast('error', '提交过程出错');
    } finally {
      setIsSubmitting(false);
    }
  }, [data, errors, showToast]);

  // 切换标签页
  const handleTabChange = (tab: 'import' | 'list') => {
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 头部 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">物流批量下单系统</h1>
              <p className="text-sm text-gray-500 mt-1">支持多模板自动识别，批量导入更高效</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                {data.length} 条待提交
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 导航 */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            <button
              onClick={() => handleTabChange('import')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'import'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <ImportIcon />
              <span className="ml-2">导入下单</span>
            </button>
            <button
              onClick={() => handleTabChange('list')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'list'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <ListIcon />
              <span className="ml-2">已导入运单</span>
            </button>
          </div>
        </div>
      </nav>

      {/* 内容 */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'import' ? (
          <div className="space-y-6">
            {/* 上传区域 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">上传 Excel 文件</h2>
              <FileUpload 
                onDataLoaded={handleDataLoaded}
                onValidationComplete={setErrors}
              />
            </div>

            {/* 数据预览 */}
            {data.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">数据预览与编辑</h2>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || errors.length > 0}
                    className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                      errors.length > 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isSubmitting ? '提交中...' : '提交下单'}
                  </button>
                </div>
                <DataPreview
                  data={data}
                  errors={errors}
                  onDataChange={handleDataChange}
                  onErrorsChange={setErrors}
                />
              </div>
            )}
          </div>
        ) : (
          <WaybillList refreshKey={refreshKey} />
        )}
      </main>

      {/* 提交进度 */}
      <ModalProgress
        open={isSubmitting}
        current={submitProgress.current}
        total={submitProgress.total}
        title="正在提交运单"
        message="请稍候，不要关闭页面..."
      />
    </div>
  );
}

function ImportIcon() {
  return (
    <svg className="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg className="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

export default function Page() {
  return (
    <ToastProvider>
      <HomePage />
    </ToastProvider>
  );
}
