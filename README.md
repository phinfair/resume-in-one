# 简历解析 Agent

AI 驱动的简历解析模块，支持图片、PDF、Word 文件解析，自动提取关键字段，记录传输日志。

## 目录结构

```
├── backend/                  # Node.js + Express + SQLite 后端
│   ├── src/
│   │   ├── app.js            # 应用入口
│   │   ├── database.js       # 数据库初始化（sqlite3）
│   │   ├── routes/
│   │   │   ├── resumes.js    # 简历上传/解析/补充路由
│   │   │   └── transferLogs.js # 传输记录路由
│   │   └── services/
│   │       ├── aiParser.js   # AI 解析服务（多 Provider）
│   │       ├── fileExtractor.js # 文件内容提取（PDF/Word/图片）
│   │       ├── knowledgeBase.js # 知识库同步服务
│   │       ├── transferLog.js   # 传输记录写入
│   │       └── schoolDatabase.js # 985/211/双一流院校库
│   ├── .env.example          # 环境变量模板（含多 AI Provider 配置示例）
│   └── package.json
│
└── frontend/                 # React + Ant Design 前端
    └── src/
        ├── pages/MainPage.jsx        # 主页面（上传/列表/传输记录）
        ├── components/
        │   ├── ResumeUpload.jsx      # 文件上传组件（拖拽）
        │   ├── ParseResultPanel.jsx  # 解析结果 + 手动补充 Drawer
        │   ├── ResumeList.jsx        # 简历库列表
        │   └── TransferLogPanel.jsx  # 传输记录面板
        └── services/api.js           # API 封装
```

## 快速启动

### 方式一：一键脚本
```bash
bash start.sh
```

### 方式二：手动启动

```bash
# 后端
cd backend
npm install
cp .env.example .env   # 填入 AI API Key
npm run dev

# 前端（新终端）
cd frontend
npm install
npm start
```

## 配置 AI 接口

编辑 `backend/.env`，选择一种 AI Provider：

| Provider | 说明 |
|----------|------|
| OpenAI / 兼容接口 | 推荐，支持 gpt-4o / vision |
| 阿里通义千问 | 国内稳定，支持 qwen-vl-max |
| 腾讯混元 | 企业版可用 hunyuan-vision |
| DeepSeek | 性价比高，deepseek-chat |
| 百度文心 | ERNIE 系列 |

## 核心功能

### 1. 文件上传解析
- **支持格式**：PDF、Word (.docx/.doc)、图片 (JPG/PNG/BMP/TIFF/WebP)
- **解析字段**：25+ 字段（姓名、手机、学历、院校、技能...）
- **985/211识别**：自动标注院校属性

### 2. 手动补充
- 解析失败或字段缺失时，系统提示手动补充
- 补充内容实时同步至 SQLite 数据库 + 知识库

### 3. 字段自定义扩展
- 内置 25 个系统字段
- 支持通过 API 动态添加自定义字段
- `POST /api/resumes/meta/fields` 添加新字段定义

### 4. 传输记录
每次操作（上传、解析、手动编辑、知识库同步）自动记录：
- 操作人、时间、文件名/类型/大小、IP 地址

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/resumes/upload | 上传并解析简历 |
| GET  | /api/resumes | 简历列表（分页/搜索）|
| GET  | /api/resumes/:id | 简历详情+字段 |
| PUT  | /api/resumes/:id/fields | 手动补充字段 |
| GET  | /api/resumes/meta/fields | 获取字段定义 |
| POST | /api/resumes/meta/fields | 添加自定义字段 |
| GET  | /api/transfer-logs | 传输记录列表 |
| GET  | /api/transfer-logs/stats | 传输统计 |

## 技术约束

- **零原生编译依赖**：sqlite3 (纯 JS binding)，禁止 better-sqlite3、node-gyp、Python
- **文件解析**：pdf-parse + mammoth（均为纯 JS）
- **AI 调用**：axios HTTP 请求，支持所有 OpenAI 兼容接口
