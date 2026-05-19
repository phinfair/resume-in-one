// =====================================================
// 知识库同步服务
// 支持 local（本地 JSON）和 api（远程 API）两种模式
// =====================================================
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { dbRun } = require('../database');
require('dotenv').config();

const KB_TYPE = process.env.KB_TYPE || 'local';
const KB_LOCAL_PATH = path.resolve(process.env.KB_LOCAL_PATH || './database/knowledge_base.json');

/**
 * 读取本地知识库
 */
function readLocalKB() {
  if (!fs.existsSync(KB_LOCAL_PATH)) {
    return { resumes: [], updated_at: new Date().toISOString() };
  }
  try {
    return JSON.parse(fs.readFileSync(KB_LOCAL_PATH, 'utf8'));
  } catch {
    return { resumes: [], updated_at: new Date().toISOString() };
  }
}

/**
 * 将简历数据同步到知识库
 * @param {string} resumeId
 * @param {object} resumeData - { id, file_name, fields: [{key, label, value}] }
 */
async function syncToKnowledgeBase(resumeId, resumeData) {
  const now = new Date().toISOString();
  let syncStatus = 'success';
  let syncError = null;

  try {
    if (KB_TYPE === 'local') {
      await syncToLocalKB(resumeId, resumeData, now);
    } else if (KB_TYPE === 'api') {
      await syncToRemoteKB(resumeId, resumeData);
    }
  } catch (err) {
    syncStatus = 'failed';
    syncError = err.message;
    console.error('[KB] 同步失败:', err.message);
  }

  // 记录同步日志
  await dbRun(
    `INSERT INTO kb_sync_logs (resume_id, sync_type, sync_status, sync_error, created_at) VALUES (?,?,?,?,?)`,
    [resumeId, KB_TYPE, syncStatus, syncError, now]
  );

  return { success: syncStatus === 'success', error: syncError };
}

/**
 * 同步到本地 JSON 知识库
 */
async function syncToLocalKB(resumeId, resumeData, now) {
  const kb = readLocalKB();
  const idx = kb.resumes.findIndex(r => r.id === resumeId);
  const entry = {
    id: resumeId,
    file_name: resumeData.file_name,
    updated_at: now,
    fields: resumeData.fields,
  };

  if (idx >= 0) {
    kb.resumes[idx] = entry;
  } else {
    kb.resumes.push(entry);
  }
  kb.updated_at = now;

  // 确保目录存在
  const dir = path.dirname(KB_LOCAL_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(KB_LOCAL_PATH, JSON.stringify(kb, null, 2), 'utf8');
  console.log(`[KB] 本地知识库已同步: ${resumeId}`);
}

/**
 * 同步到远程 API 知识库
 */
async function syncToRemoteKB(resumeId, resumeData) {
  const kbUrl = process.env.KB_API_URL;
  const kbKey = process.env.KB_API_KEY;
  if (!kbUrl) throw new Error('未配置 KB_API_URL');

  await axios.post(
    `${kbUrl}/resumes/${resumeId}`,
    resumeData,
    {
      headers: {
        'Authorization': `Bearer ${kbKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );
  console.log(`[KB] 远程知识库已同步: ${resumeId}`);
}

module.exports = { syncToKnowledgeBase };
