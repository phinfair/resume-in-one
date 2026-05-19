// =====================================================
// 传输记录服务
// =====================================================
const { dbRun } = require('../database');

/**
 * 写入传输记录
 * @param {object} opts
 * @param {string} opts.resumeId
 * @param {string} opts.operator  - 操作人（从 header 或 body 获取）
 * @param {string} opts.action    - upload | parse | manual_edit | kb_sync
 * @param {string} [opts.fileName]
 * @param {string} [opts.fileType]
 * @param {number} [opts.fileSize]
 * @param {string} [opts.ipAddress]
 * @param {object} [opts.detail]  - 附加信息，存为 JSON
 */
async function logTransfer(opts) {
  const now = new Date().toISOString();
  const detail = opts.detail ? JSON.stringify(opts.detail) : null;

  await dbRun(
    `INSERT INTO transfer_logs
      (resume_id, operator, action, file_name, file_type, file_size, ip_address, detail, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      opts.resumeId || null,
      opts.operator || '匿名用户',
      opts.action,
      opts.fileName || null,
      opts.fileType || null,
      opts.fileSize || null,
      opts.ipAddress || null,
      detail,
      now,
    ]
  );
}

/**
 * 从 Express Request 中提取操作人和 IP
 */
function extractRequestMeta(req) {
  const operator =
    req.headers['x-operator'] ||
    req.body?.operator ||
    req.query?.operator ||
    '匿名用户';

  const ipAddress =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  return { operator, ipAddress };
}

module.exports = { logTransfer, extractRequestMeta };
