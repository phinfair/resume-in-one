// =====================================================
// 文件内容提取服务
// 支持 PDF、Word (.docx)、图片（base64）
// 依赖：pdf-parse, mammoth（纯JS，无native依赖）
// =====================================================
const fs = require('fs');
const path = require('path');

/**
 * 从文件中提取文本或图片 base64
 * @param {string} filePath - 文件绝对路径
 * @param {string} mimeType - MIME 类型
 * @returns {{ text: string|null, imageBase64: string|null, error: string|null }}
 */
async function extractFileContent(filePath, mimeType) {
  try {
    const ext = path.extname(filePath).toLowerCase();

    // ===== PDF =====
    if (mimeType === 'application/pdf' || ext === '.pdf') {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      const text = data.text || '';
      if (text.trim().length < 30) {
        // PDF 可能是扫描件，转为图片处理
        const imageBase64 = buffer.toString('base64');
        return { text: null, imageBase64, mimeType: 'application/pdf', error: null, isPdfImage: true };
      }
      return { text, imageBase64: null, error: null };
    }

    // ===== Word (.docx) =====
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === '.docx'
    ) {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return { text: result.value || '', imageBase64: null, error: null };
    }

    // ===== Word (.doc 旧格式) =====
    if (mimeType === 'application/msword' || ext === '.doc') {
      // 旧版 .doc 无法用 mammoth 完美解析，尝试读取可见文本
      const buffer = fs.readFileSync(filePath);
      const text = buffer.toString('utf8', 0, buffer.length).replace(/[^\x20-\x7E\u4e00-\u9fa5]/g, ' ').replace(/\s+/g, ' ');
      if (text.trim().length > 20) {
        return { text, imageBase64: null, error: null };
      }
      // 退化为图片模式
      const imageBase64 = buffer.toString('base64');
      return { text: null, imageBase64, mimeType: 'application/msword', error: null };
    }

    // ===== 图片 =====
    if (
      mimeType?.startsWith('image/') ||
      ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'].includes(ext)
    ) {
      const buffer = fs.readFileSync(filePath);
      const imageBase64 = buffer.toString('base64');
      return { text: null, imageBase64, mimeType: mimeType || `image/${ext.slice(1)}`, error: null };
    }

    return { text: null, imageBase64: null, error: `不支持的文件格式: ${ext}` };
  } catch (err) {
    return { text: null, imageBase64: null, error: `文件读取失败: ${err.message}` };
  }
}

module.exports = { extractFileContent };
