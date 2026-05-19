// =====================================================
// 传输记录路由
// GET /api/transfer-logs
// =====================================================
const express = require('express');
const router = express.Router();
const { dbAll, dbGet } = require('../database');

// ===== 获取传输记录列表 =====
// GET /api/transfer-logs?page=1&pageSize=20&resumeId=&action=&operator=
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 20;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  const params = [];

  if (req.query.resumeId) {
    conditions.push('resume_id=?');
    params.push(req.query.resumeId);
  }
  if (req.query.action) {
    conditions.push('action=?');
    params.push(req.query.action);
  }
  if (req.query.operator) {
    conditions.push('operator LIKE ?');
    params.push(`%${req.query.operator}%`);
  }
  if (req.query.dateFrom) {
    conditions.push('created_at >= ?');
    params.push(req.query.dateFrom);
  }
  if (req.query.dateTo) {
    conditions.push('created_at <= ?');
    params.push(req.query.dateTo + 'T23:59:59');
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    const total = await dbGet(`SELECT COUNT(*) as cnt FROM transfer_logs ${where}`, params);
    const rows = await dbAll(
      `SELECT * FROM transfer_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    // 解析 detail JSON 字段
    const data = rows.map(r => ({
      ...r,
      detail: r.detail ? (() => { try { return JSON.parse(r.detail); } catch { return r.detail; } })() : null,
    }));

    return res.json({ success: true, total: total.cnt, page, pageSize, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ===== 获取操作统计 =====
// GET /api/transfer-logs/stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await dbAll(
      `SELECT action, COUNT(*) as count, DATE(created_at) as date
       FROM transfer_logs
       WHERE created_at >= datetime('now', '-30 days')
       GROUP BY action, DATE(created_at)
       ORDER BY date DESC`
    );
    const operatorStats = await dbAll(
      `SELECT operator, COUNT(*) as total_count, MAX(created_at) as last_at
       FROM transfer_logs
       GROUP BY operator
       ORDER BY total_count DESC
       LIMIT 20`
    );
    return res.json({ success: true, byAction: stats, byOperator: operatorStats });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
