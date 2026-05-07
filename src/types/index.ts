// 运单数据类型
export interface Waybill {
  id: string;
  externalCode: string;    // 外部编码
  senderName: string;      // 发件人姓名
  senderPhone: string;     // 发件人电话
  senderAddress: string;   // 发件人地址
  receiverName: string;    // 收件人姓名
  receiverPhone: string;   // 收件人电话
  receiverAddress: string; // 收件人地址
  weight: number;          // 重量(kg)
  quantity: number;        // 件数
  tempZone: '常温' | '冷藏' | '冷冻'; // 温层
  note: string;            // 备注
  status: 'pending' | 'submitted' | 'failed';
  createdAt: string;
  submitAt?: string;
}

// Excel原始行数据
export interface RawRow {
  [key: string]: string | number | null;
}

// 字段映射规则
export interface FieldMapping {
  fieldName: string;       // 系统字段名
  columnIndex: number;     // Excel列索引
  excelColumnName: string;  // Excel列名
}

// 模板配置
export interface TemplateConfig {
  id: string;
  name: string;
  headerRow: number;       // 表头所在行
  fieldMappings: FieldMapping[];
  createdAt: string;
}

// 导入结果
export interface ImportResult {
  success: boolean;
  data: Waybill[];
  errors: ValidationError[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

// 校验错误
export interface ValidationError {
  row: number;
  field: string;
  fieldLabel: string;
  message: string;
  type: 'required' | 'format' | 'duplicate' | 'range';
}

// 模板学习记录
export interface TemplateFingerprint {
  fingerprint: string;    // 基于列名的指纹
  mappings: FieldMapping[];
  createdAt: string;
  usageCount: number;
}

// 上传进度
export interface UploadProgress {
  current: number;
  total: number;
  percentage: number;
}

// 提交结果
export interface SubmitResult {
  success: boolean;
  totalSubmitted: number;
  successCount: number;
  failedCount: number;
  errors: { row: number; message: string }[];
}

// 温层选项
export const TEMP_ZONES = ['常温', '冷藏', '冷冻'] as const;

// 系统字段定义
export const SYSTEM_FIELDS = [
  { name: 'externalCode', label: '外部编码', required: false },
  { name: 'senderName', label: '发件人姓名', required: true },
  { name: 'senderPhone', label: '发件人电话', required: true },
  { name: 'senderAddress', label: '发件人地址', required: true },
  { name: 'receiverName', label: '收件人姓名', required: true },
  { name: 'receiverPhone', label: '收件人电话', required: true },
  { name: 'receiverAddress', label: '收件人地址', required: true },
  { name: 'weight', label: '重量(kg)', required: true },
  { name: 'quantity', label: '件数', required: true },
  { name: 'tempZone', label: '温层', required: true },
  { name: 'note', label: '备注', required: false },
] as const;

// 列名同义词映射（用于自动识别）
export const COLUMN_SYNONYMS: Record<string, string[]> = {
  externalCode: ['外部编码', '外部订单号', '客户单号', '订单号', 'Ref Code', '订单编号', '单号'],
  senderName: ['发件人', '发件人姓名', '发货人', '寄件人', 'Sender', '发货方'],
  senderPhone: ['发件人电话', '发件电话', '发货电话', '寄件人电话', 'Sender Tel', '发货方电话'],
  senderAddress: ['发件人地址', '发件地址', '发货地址', '寄件人地址', 'Sender Address', '发货方地址'],
  receiverName: ['收件人', '收件人姓名', '收货人', 'Receiver', '收货方', '收方'],
  receiverPhone: ['收件人电话', '收件电话', '收货电话', 'Receiver Tel', '收货方电话', '收方电话'],
  receiverAddress: ['收件人地址', '收件地址', '收货地址', 'Receiver Address', '收货方地址', '收方地址'],
  weight: ['重量', '重量(kg)', '重量kg', '重量(KG)', 'Weight', 'Weight(kg)'],
  quantity: ['件数', '数量', 'Qty', '包裹数', '商品数量'],
  tempZone: ['温层', '温度要求', '温度', 'Temp Zone', '储存方式', '制冷方式'],
  note: ['备注', '附言', 'Note', '备注信息', '说明'],
};
