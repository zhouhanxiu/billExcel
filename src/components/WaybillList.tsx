'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Waybill } from '@/types';
import { getWaybillList, deleteWaybill } from '@/lib/database';
import { useToast } from './Toast';

interface WaybillListProps {
  refreshKey?: number;
}

export function WaybillList({ refreshKey }: WaybillListProps) {
  const [data, setData] = useState<Waybill[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState({
    externalCode: '',
    receiverName: '',
    startDate: '',
    endDate: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const { showToast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getWaybillList(page, pageSize, {
        externalCode: search.externalCode || undefined,
        receiverName: search.receiverName || undefined,
        startDate: search.startDate || undefined,
        endDate: search.endDate || undefined,
      });
      setData(result.data);
      setTotal(result.total);
    } catch (e) {
      showToast('error', '获取数据失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条运单吗？')) return;
    
    const success = await deleteWaybill(id);
    if (success) {
      showToast('success', '删除成功');
      fetchData();
    } else {
      showToast('error', '删除失败');
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* 搜索栏 */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="搜索外部编码..."
              value={search.externalCode}
              onChange={(e) => setSearch(s => ({ ...s, externalCode: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex-1">
            <input
              type="text"
              placeholder="搜索收件人姓名..."
              value={search.receiverName}
              onChange={(e) => setSearch(s => ({ ...s, receiverName: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <FilterIcon />
          </button>
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            搜索
          </button>
        </div>

        {/* 高级筛选 */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">开始日期</label>
              <input
                type="date"
                value={search.startDate}
                onChange={(e) => setSearch(s => ({ ...s, startDate: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">结束日期</label>
              <input
                type="date"
                value={search.endDate}
                onChange={(e) => setSearch(s => ({ ...s, endDate: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
        )}
      </div>

      {/* 数据统计 */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">
            共 <span className="font-semibold text-gray-900">{total}</span> 条运单
          </span>
          <span className="text-sm text-gray-500">
            第 {page} / {totalPages || 1} 页
          </span>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <LoadingSpinner />
            <p className="mt-2">加载中...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            暂无运单数据
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">外部编码</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">发件人</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">收件人</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">收件人电话</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">重量(kg)</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">件数</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">温层</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">提交时间</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm">
                      {item.externalCode || '-'}
                    </td>
                    <td className="px-4 py-3">{item.senderName}</td>
                    <td className="px-4 py-3">{item.receiverName}</td>
                    <td className="px-4 py-3">{item.receiverPhone}</td>
                    <td className="px-4 py-3">{item.weight}</td>
                    <td className="px-4 py-3">{item.quantity}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        item.tempZone === '常温' ? 'bg-gray-200' :
                        item.tempZone === '冷藏' ? 'bg-blue-100 text-blue-700' :
                        'bg-cyan-100 text-cyan-700'
                      }`}>
                        {item.tempZone}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {item.submitAt ? new Date(item.submitAt).toLocaleString('zh-CN') : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="删除"
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-gray-100"
          >
            首页
          </button>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-gray-100"
          >
            上一页
          </button>
          <span className="px-4 py-1">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-gray-100"
          >
            下一页
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-gray-100"
          >
            末页
          </button>
        </div>
      )}
    </div>
  );
}

// 图标
function FilterIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
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

function LoadingSpinner() {
  return (
    <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
