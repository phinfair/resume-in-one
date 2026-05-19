// =====================================================
// AI 简历解析服务
// 支持多种 AI Provider（OpenAI 兼容协议、通义、混元等）
// =====================================================
const axios = require('axios');
const { checkSchoolTags } = require('./schoolDatabase');
require('dotenv').config();

// ===== Prompt 模板 =====
const SYSTEM_PROMPT = `你是一个专业的简历信息提取 AI，负责从简历文本或图片中提取结构化数据。

提取以下字段（无法识别的字段返回 null，不要猜测）：
- name: 姓名
- phone: 手机号（格式：11位数字，去除空格和符号）
- email: 邮箱
- gender: 性别（男/女/null）
- age: 年龄（数字字符串）
- birth_date: 出生日期（YYYY-MM-DD 格式）
- education: 最高学历（本科/硕士/博士/大专/中专/高中/其他）
- school: 毕业院校（最高学历对应院校，仅写校名）
- major: 专业
- grad_year: 毕业年份（4位数字）
- work_years: 工作年限（如"3年"、"5-10年"）
- current_company: 当前/最近公司名称
- current_title: 当前/最近职位
- expected_salary: 期望薪资（如"15k-20k"、"面议"）
- expected_city: 期望工作城市
- skills: 技能标签（英文逗号分隔列表，如"Java,Python,Spring Boot,MySQL"）
- certificates: 证书资质（逗号分隔）
- languages: 语言能力（如"英语CET-6,普通话"）
- work_history: 工作经历摘要（最近3段经历，每段50字内）
- self_evaluation: 自我评价（100字内）
- home_city: 籍贯/户籍
- current_city: 目前居住城市

严格以 JSON 格式返回，字段名与上面完全一致，不能多余字段，示例：
{"name":"张三","phone":"13800138000","email":"zhangsan@example.com",...}

如果某字段无法从简历中提取，其值设为 null。不要添加任何解释或 markdown 格式。`;

/**
 * 调用 AI 解析简历内容
 */
async function parseResumeWithAI(content) {
  const provider = process.env.AI_PROVIDER || 'openai';
  try {
    if (provider === 'openai' || provider === 'qwen' || provider === 'deepseek') {
      return await callOpenAICompatible(content);
    } else if (provider === 'hunyuan') {
      return await callHunyuan(content);
    } else {
      return await callOpenAICompatible(content);
    }
  } catch (err) {
    throw new Error(`AI 解析失败 [${provider}]: ${err.message}`);
  }
}

// ===== OpenAI 兼容接口（OpenAI / 通义千问 / DeepSeek）=====
async function callOpenAICompatible(content) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.QWEN_API_KEY || process.env.DEEPSEEK_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL || process.env.QWEN_BASE_URL || process.env.DEEPSEEK_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL || process.env.QWEN_MODEL || process.env.DEEPSEEK_MODEL || 'gpt-4o';

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  // 图片内容：使用 vision 模式
  if (content.imageBase64) {
    const imgMime = content.mimeType || 'image/jpeg';
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: '请从这份简历图片/文件中提取所有字段信息：' },
        {
          type: 'image_url',
          image_url: { url: `data:${imgMime};base64,${content.imageBase64}` },
        },
      ],
    });
  } else {
    messages.push({
      role: 'user',
      content: `请从以下简历文本中提取所有字段信息：\n\n${content.text}`,
    });
  }

  const response = await axios.post(
    `${baseURL}/chat/completions`,
    { model, messages, temperature: 0.1, max_tokens: 2000 },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    }
  );

  const raw = response.data?.choices?.[0]?.message?.content || '';
  return parseAIResponse(raw);
}

// ===== 腾讯混元（TencentCloud SDK 调用方式）=====
async function callHunyuan(content) {
  // 混元使用签名认证，这里通过其 OpenAI 兼容接口简化调用
  const apiKey = process.env.HUNYUAN_API_KEY || '';
  const baseURL = 'https://api.hunyuan.cloud.tencent.com/v1';
  const model = 'hunyuan-vision';

  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  if (content.imageBase64) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: '请从这份简历图片中提取所有字段信息：' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${content.imageBase64}` } },
      ],
    });
  } else {
    messages.push({ role: 'user', content: `请从以下简历文本中提取所有字段信息：\n\n${content.text}` });
  }

  const response = await axios.post(
    `${baseURL}/chat/completions`,
    { model, messages, temperature: 0.1 },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    }
  );

  const raw = response.data?.choices?.[0]?.message?.content || '';
  return parseAIResponse(raw);
}

/**
 * 解析 AI 返回的 JSON 字符串，并补充 985/211 标识
 */
function parseAIResponse(raw) {
  // 提取 JSON（处理 markdown code block 包裹情况）
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI 返回格式无法解析为 JSON');
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`JSON 解析失败: ${e.message}`);
  }

  // 补充 985/211/双一流 标识
  if (parsed.school) {
    const tags = checkSchoolTags(parsed.school);
    parsed.school_985 = tags.is985 ? '是' : '否';
    parsed.school_211 = tags.is211 ? '是' : '否';
    parsed.school_double_top = tags.isDoubleTop ? '是' : '否';
  }

  return parsed;
}

/**
 * 计算哪些必填字段缺失（供手动补充提示用）
 */
function getMissingCriticalFields(parsed) {
  const critical = [
    { key: 'name', label: '姓名' },
    { key: 'phone', label: '手机号' },
    { key: 'school', label: '毕业院校' },
    { key: 'education', label: '最高学历' },
    { key: 'skills', label: '技能标签' },
  ];
  return critical.filter(f => !parsed[f.key]);
}

module.exports = { parseResumeWithAI, getMissingCriticalFields };
