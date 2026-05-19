// =====================================================
// Express 应用入口
// =====================================================
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const { initDatabase } = require('./database');
const resumeRouter = require('./routes/resumes');
const transferLogRouter = require('./routes/transferLogs');

const app = express();
const PORT = process.env.PORT || 3001;

// ===== 中间件 =====
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// 静态文件服务（上传的文件预览）
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || './uploads')));

// ===== 路由 =====
app.use('/api/resumes', resumeRouter);
app.use('/api/transfer-logs', transferLogRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ===== Multer 错误处理 =====
app.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: '文件大小超过限制（最大20MB）' });
  }
  if (err?.message?.includes('不支持的文件类型')) {
    return res.status(415).json({ success: false, message: err.message });
  }
  console.error('[APP] 未处理错误:', err);
  return res.status(500).json({ success: false, message: err.message || '服务器内部错误' });
});

// ===== 启动 =====
async function bootstrap() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`\n✅ 简历解析服务已启动: http://localhost:${PORT}`);
      console.log(`   API 前缀: /api/resumes`);
      console.log(`   传输记录: /api/transfer-logs`);
      console.log(`   健康检查: /api/health\n`);
    });
  } catch (err) {
    console.error('服务启动失败:', err);
    process.exit(1);
  }
}

bootstrap();
