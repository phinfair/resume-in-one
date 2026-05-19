// =====================================================
// 简历上传 & 解析路由
// POST /api/resumes/upload
// =====================================================
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { dbRun, dbGet, dbAll } = require('../database');
const { extractFileContent } = require('../services/fileExtractor');
const { parseResumeWithAI, getMissingCriticalFields } = require('../services/aiParser');
const { syncToKnowledgeBase } = require('../services/knowledgeBase');
const { logTransfer, extractRequestMeta } = require('../services/transferLog');
require('dotenv').config();

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ===== Multer 配置 =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${uuidv4()}${ext}`;
    cb(null, safeName);
  },
});

const ALLOWED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/webp',
  'image/tiff',
];

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${file.mimetype}`), false);
    }
  },
});

// ===== 上传并解析 =====
// POST /api/resumes/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  const { operator, ipAddress } = extractRequestMeta(req);
  const now = new Date().toISOString();

  if (!req.file) {
    return res.status(400).json({ success: false, message: '未接收到文件' });
  }

  const resumeId = uuidv4();
  const { originalname, mimetype, size, filename } = req.file;
  const filePath = path.join(UPLOAD_DIR, filename);

  // 简单文件类型映射
  const typeMap = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
    'application/msword': 'word',
  };
  const fileType = typeMap[mimetype] || 'image';

  try {
    // 1. 写入简历主记录（pending状态）
    await dbRun(
      `INSERT INTO resumes (id, file_name, file_type, file_path, file_size, parse_status, created_at, updated_at)
       VALUES (?,?,?,?,?,'pending',?,?)`,
      [resumeId, originalname, fileType, filePath, size, now, now]
    );

    // 2. 记录上传传输日志
    await logTransfer({
      resumeId,
      operator,
      action: 'upload',
      fileName: originalname,
      fileType,
      fileSize: size,
      ipAddress,
      detail: { mimetype, savedAs: filename },
    });

    // 3. 提取文件内容
    const extracted = await extractFileContent(filePath, mimetype);

    if (extracted.error && !extracted.imageBase64 && !extracted.text) {
      // 文件损坏或格式不支持
      await dbRun(
        `UPDATE resumes SET parse_status='failed', parse_error=?, updated_at=? WHERE id=?`,
        [extracted.error, now, resumeId]
      );
      return res.json({
        success: false,
        resumeId,
        parseStatus: 'failed',
        message: extracted.error,
        requireManualInput: true,
        missingFields: await getAllFieldDefinitions(),
      });
    }

    // 4. 保存提取的原始文本
    if (extracted.text) {
      await dbRun(`UPDATE resumes SET raw_text=?, updated_at=? WHERE id=?`, [extracted.text, now, resumeId]);
    }

    // 5. AI 解析
    let parsedFields = {};
    let parseStatus = 'success';
    let parseError = null;

    try {
      parsedFields = await parseResumeWithAI(extracted);
      await logTransfer({ resumeId, operator, action: 'parse', ipAddress, detail: { fieldsCount: Object.keys(parsedFields).length } });
    } catch (aiErr) {
      parseStatus = 'partial';
      parseError = aiErr.message;
      console.error('[Parse] AI 解析异常:', aiErr.message);
    }

    // 6. 写入解析字段
    const fieldDefs = await getAllFieldDefinitions();
    const insertedFields = [];

    for (const def of fieldDefs) {
      const value = parsedFields[def.field_key] ?? null;
      const confidence = value !== null ? 0.9 : 0.0;
      await dbRun(
        `INSERT INTO resume_fields (resume_id, field_key, field_label, field_value, confidence, is_manual, is_verified, created_at, updated_at)
         VALUES (?,?,?,?,?,0,0,?,?)`,
        [resumeId, def.field_key, def.field_label, value !== null ? String(value) : null, confidence, now, now]
      );
      insertedFields.push({ key: def.field_key, label: def.field_label, value, confidence });
    }

    // 7. 更新简历解析状态
    await dbRun(
      `UPDATE resumes SET parse_status=?, parse_error=?, updated_at=? WHERE id=?`,
      [parseStatus, parseError, now, resumeId]
    );

    // 8. 计算缺失字段
    const missingFields = getMissingCriticalFields(parsedFields);

    // 9. 同步到知识库
    await syncToKnowledgeBase(resumeId, {
      file_name: originalname,
      fields: insertedFields,
    });

    return res.json({
      success: true,
      resumeId,
      parseStatus,
      parseError,
      fields: insertedFields,
      missingFields,
      requireManualInput: missingFields.length > 0 || parseStatus !== 'success',
    });
  } catch (err) {
    console.error('[Upload] 处理异常:', err);
    return res.status(500).json({ success: false, message: `服务器错误: ${err.message}` });
  }
});

// ===== 手动补充/修改字段 =====
// PUT /api/resumes/:id/fields
router.put('/:id/fields', async (req, res) => {
  const { id: resumeId } = req.params;
  const { fields } = req.body; // [{ key, value }]
  const { operator, ipAddress } = extractRequestMeta(req);
  const now = new Date().toISOString();

  if (!fields || !Array.isArray(fields)) {
    return res.status(400).json({ success: false, message: 'fields 参数必须为数组' });
  }

  try {
    const resume = await dbGet('SELECT id FROM resumes WHERE id=?', [resumeId]);
    if (!resume) return res.status(404).json({ success: false, message: '简历不存在' });

    for (const f of fields) {
      if (!f.key) continue;
      // 检查字段是否存在，存在则更新，否则插入
      const existing = await dbGet(
        'SELECT id FROM resume_fields WHERE resume_id=? AND field_key=?',
        [resumeId, f.key]
      );
      if (existing) {
        await dbRun(
          'UPDATE resume_fields SET field_value=?, is_manual=1, is_verified=1, confidence=1.0, updated_at=? WHERE resume_id=? AND field_key=?',
          [f.value !== undefined ? String(f.value) : null, now, resumeId, f.key]
        );
      } else {
        // 可能是自定义扩展字段
        const def = await dbGet('SELECT field_label FROM field_definitions WHERE field_key=?', [f.key]);
        await dbRun(
          `INSERT INTO resume_fields (resume_id, field_key, field_label, field_value, confidence, is_manual, is_verified, created_at, updated_at)
           VALUES (?,?,?,?,1.0,1,1,?,?)`,
          [resumeId, f.key, def?.field_label || f.key, f.value !== undefined ? String(f.value) : null, now, now]
        );
      }
    }

    // 更新 parse_status
    await dbRun('UPDATE resumes SET parse_status=\'partial\', updated_at=? WHERE id=? AND parse_status=\'failed\'', [now, resumeId]);

    // 记录传输日志
    await logTransfer({
      resumeId,
      operator,
      action: 'manual_edit',
      ipAddress,
      detail: { editedFields: fields.map(f => f.key) },
    });

    // 重新同步知识库
    const allFields = await dbAll(
      'SELECT field_key as key, field_label as label, field_value as value FROM resume_fields WHERE resume_id=?',
      [resumeId]
    );
    const resumeInfo = await dbGet('SELECT file_name FROM resumes WHERE id=?', [resumeId]);
    await syncToKnowledgeBase(resumeId, { file_name: resumeInfo?.file_name, fields: allFields });

    return res.json({ success: true, message: '字段已更新并同步至知识库' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ===== 获取简历详情 =====
// GET /api/resumes/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const resume = await dbGet('SELECT * FROM resumes WHERE id=?', [id]);
    if (!resume) return res.status(404).json({ success: false, message: '简历不存在' });

    const fields = await dbAll(
      'SELECT field_key as key, field_label as label, field_value as value, confidence, is_manual, is_verified FROM resume_fields WHERE resume_id=? ORDER BY rowid',
      [id]
    );
    return res.json({ success: true, resume: { ...resume, fields } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ===== 获取简历列表 =====
// GET /api/resumes?page=1&pageSize=20&search=
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 20;
  const search = req.query.search || '';
  const offset = (page - 1) * pageSize;

  try {
    let where = '';
    let params = [];
    if (search) {
      where = `WHERE r.id IN (
        SELECT DISTINCT resume_id FROM resume_fields WHERE field_value LIKE ?
      ) OR r.file_name LIKE ?`;
      params = [`%${search}%`, `%${search}%`];
    }

    const total = await dbGet(`SELECT COUNT(*) as cnt FROM resumes r ${where}`, params);
    const rows = await dbAll(
      `SELECT r.id, r.file_name, r.file_type, r.parse_status, r.created_at,
        (SELECT field_value FROM resume_fields WHERE resume_id=r.id AND field_key='name' LIMIT 1) as name,
        (SELECT field_value FROM resume_fields WHERE resume_id=r.id AND field_key='phone' LIMIT 1) as phone,
        (SELECT field_value FROM resume_fields WHERE resume_id=r.id AND field_key='school' LIMIT 1) as school,
        (SELECT field_value FROM resume_fields WHERE resume_id=r.id AND field_key='school_985' LIMIT 1) as is_985,
        (SELECT field_value FROM resume_fields WHERE resume_id=r.id AND field_key='school_211' LIMIT 1) as is_211
       FROM resumes r ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return res.json({ success: true, total: total.cnt, page, pageSize, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ===== 获取字段定义（用于前端自定义扩展）=====
// GET /api/resumes/meta/fields
router.get('/meta/fields', async (req, res) => {
  try {
    const fields = await getAllFieldDefinitions();
    return res.json({ success: true, fields });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ===== 添加自定义字段定义 =====
// POST /api/resumes/meta/fields
router.post('/meta/fields', async (req, res) => {
  const { field_key, field_label, field_type, options } = req.body;
  const now = new Date().toISOString();
  if (!field_key || !field_label) {
    return res.status(400).json({ success: false, message: 'field_key 和 field_label 为必填' });
  }
  try {
    await dbRun(
      `INSERT INTO field_definitions (field_key, field_label, field_type, is_system, options, created_at)
       VALUES (?,?,?,0,?,?)`,
      [field_key, field_label, field_type || 'text', options ? JSON.stringify(options) : null, now]
    );
    return res.json({ success: true, message: '自定义字段已添加' });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ success: false, message: '字段 key 已存在' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ===== Helper =====
async function getAllFieldDefinitions() {
  return dbAll('SELECT field_key, field_label, field_type, options FROM field_definitions WHERE is_active=1 ORDER BY sort_order, id');
}

module.exports = router;
