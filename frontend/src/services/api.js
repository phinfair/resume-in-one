import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
});

api.interceptors.response.use(
  res => res.data,
  err => {
    const msg = err.response?.data?.message || err.message || '网络错误';
    return Promise.reject(new Error(msg));
  }
);

// ===== 简历相关 =====

/** 上传简历文件（支持传输人标识） */
export function uploadResume(file, operator = '默认用户') {
  const form = new FormData();
  form.append('file', file);
  form.append('operator', operator);
  return api.post('/resumes/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data', 'x-operator': operator },
  });
}

/** 获取简历详情（含所有字段） */
export function getResume(id) {
  return api.get(`/resumes/${id}`);
}

/** 获取简历列表 */
export function listResumes(params = {}) {
  return api.get('/resumes', { params });
}

/** 手动补充/修改字段 */
export function updateResumeFields(id, fields, operator = '默认用户') {
  return api.put(`/resumes/${id}/fields`, { fields, operator });
}

/** 获取字段定义列表 */
export function getFieldDefinitions() {
  return api.get('/resumes/meta/fields');
}

/** 添加自定义字段定义 */
export function addFieldDefinition(data) {
  return api.post('/resumes/meta/fields', data);
}

// ===== 传输记录 =====

/** 获取传输记录列表 */
export function listTransferLogs(params = {}) {
  return api.get('/transfer-logs', { params });
}

/** 获取传输统计 */
export function getTransferStats() {
  return api.get('/transfer-logs/stats');
}
