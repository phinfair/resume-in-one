// =====================================================
// 数据库初始化模块
// 使用 sqlite3（纯 JS，无需 node-gyp/Visual Studio）
// =====================================================
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const DB_PATH = path.resolve(process.env.DB_PATH || './database/resume.db');

// 确保数据库目录存在
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('[DB] 连接失败:', err.message);
    process.exit(1);
  }
  console.log('[DB] SQLite 数据库已连接:', DB_PATH);
});

// 开启 WAL 模式提升并发性能
db.run('PRAGMA journal_mode=WAL');
db.run('PRAGMA foreign_keys=ON');

// ===== 建表 SQL =====
const INIT_SQL = `
-- 简历主表
CREATE TABLE IF NOT EXISTS resumes (
  id            TEXT PRIMARY KEY,
  file_name     TEXT NOT NULL,
  file_type     TEXT NOT NULL,        -- pdf | image | word
  file_path     TEXT NOT NULL,
  file_size     INTEGER,
  parse_status  TEXT DEFAULT 'pending', -- pending | success | partial | failed
  parse_error   TEXT,
  raw_text      TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- 简历解析字段表（支持自定义扩展）
CREATE TABLE IF NOT EXISTS resume_fields (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  resume_id     TEXT NOT NULL,
  field_key     TEXT NOT NULL,        -- 字段键名
  field_label   TEXT NOT NULL,        -- 字段显示名
  field_value   TEXT,                 -- 字段值
  confidence    REAL DEFAULT 1.0,     -- AI 置信度 0-1
  is_manual     INTEGER DEFAULT 0,    -- 0=AI解析 1=手动补充
  is_verified   INTEGER DEFAULT 0,    -- 是否已人工核实
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  FOREIGN KEY(resume_id) REFERENCES resumes(id) ON DELETE CASCADE
);

-- 自定义字段定义表（可扩展）
CREATE TABLE IF NOT EXISTS field_definitions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  field_key     TEXT UNIQUE NOT NULL,
  field_label   TEXT NOT NULL,
  field_type    TEXT DEFAULT 'text',  -- text | select | date | boolean
  is_system     INTEGER DEFAULT 0,    -- 0=用户自定义 1=系统内置
  is_active     INTEGER DEFAULT 1,
  sort_order    INTEGER DEFAULT 100,
  options       TEXT,                 -- JSON 数组（select 类型用）
  created_at    TEXT NOT NULL
);

-- 传输记录表
CREATE TABLE IF NOT EXISTS transfer_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  resume_id     TEXT,
  operator      TEXT NOT NULL,        -- 传输人
  action        TEXT NOT NULL,        -- upload | parse | manual_edit | kb_sync
  file_name     TEXT,
  file_type     TEXT,
  file_size     INTEGER,
  ip_address    TEXT,
  detail        TEXT,                 -- JSON 格式的操作详情
  created_at    TEXT NOT NULL
);

-- 知识库同步记录
CREATE TABLE IF NOT EXISTS kb_sync_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  resume_id     TEXT NOT NULL,
  sync_type     TEXT NOT NULL,        -- local | api
  sync_status   TEXT NOT NULL,        -- success | failed
  sync_error    TEXT,
  created_at    TEXT NOT NULL,
  FOREIGN KEY(resume_id) REFERENCES resumes(id)
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_resume_fields_resume_id ON resume_fields(resume_id);
CREATE INDEX IF NOT EXISTS idx_transfer_logs_resume_id ON transfer_logs(resume_id);
CREATE INDEX IF NOT EXISTS idx_transfer_logs_created_at ON transfer_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_resumes_created_at ON resumes(created_at);
`;

// 插入系统内置字段定义
const INSERT_DEFAULT_FIELDS = `
INSERT OR IGNORE INTO field_definitions (field_key, field_label, field_type, is_system, sort_order, created_at) VALUES
  ('name',            '姓名',           'text',   1,  1,  datetime('now')),
  ('phone',           '手机号码',       'text',   1,  2,  datetime('now')),
  ('email',           '邮箱',           'text',   1,  3,  datetime('now')),
  ('gender',          '性别',           'select', 1,  4,  datetime('now')),
  ('age',             '年龄',           'text',   1,  5,  datetime('now')),
  ('birth_date',      '出生日期',       'date',   1,  6,  datetime('now')),
  ('education',       '最高学历',       'select', 1,  7,  datetime('now')),
  ('school',          '毕业院校',       'text',   1,  8,  datetime('now')),
  ('school_985',      '是否985',        'boolean',1,  9,  datetime('now')),
  ('school_211',      '是否211',        'boolean',1,  10, datetime('now')),
  ('school_double_top','是否双一流',    'boolean',1,  11, datetime('now')),
  ('major',           '专业',           'text',   1,  12, datetime('now')),
  ('grad_year',       '毕业年份',       'text',   1,  13, datetime('now')),
  ('work_years',      '工作年限',       'text',   1,  14, datetime('now')),
  ('current_company', '当前公司',       'text',   1,  15, datetime('now')),
  ('current_title',   '当前职位',       'text',   1,  16, datetime('now')),
  ('expected_salary', '期望薪资',       'text',   1,  17, datetime('now')),
  ('expected_city',   '期望城市',       'text',   1,  18, datetime('now')),
  ('skills',          '技能标签',       'text',   1,  19, datetime('now')),
  ('certificates',    '证书资质',       'text',   1,  20, datetime('now')),
  ('languages',       '语言能力',       'text',   1,  21, datetime('now')),
  ('work_history',    '工作经历摘要',   'text',   1,  22, datetime('now')),
  ('self_evaluation', '自我评价',       'text',   1,  23, datetime('now')),
  ('home_city',       '籍贯/户籍',      'text',   1,  24, datetime('now')),
  ('current_city',    '目前居住城市',   'text',   1,  25, datetime('now'))
`;

/**
 * 初始化数据库：建表 + 插入默认字段定义
 */
function initDatabase() {
  return new Promise((resolve, reject) => {
    db.exec(INIT_SQL, (err) => {
      if (err) {
        console.error('[DB] 建表失败:', err.message);
        return reject(err);
      }
      db.exec(INSERT_DEFAULT_FIELDS, (err2) => {
        if (err2) {
          console.error('[DB] 插入默认字段定义失败:', err2.message);
          return reject(err2);
        }
        console.log('[DB] 数据库初始化完成');
        resolve();
      });
    });
  });
}

/**
 * Promise 封装的 db.run
 */
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/**
 * Promise 封装的 db.get
 */
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

/**
 * Promise 封装的 db.all
 */
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

module.exports = { db, initDatabase, dbRun, dbGet, dbAll };
