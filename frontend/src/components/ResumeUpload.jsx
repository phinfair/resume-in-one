import React, { useState, useCallback } from 'react';
import {
  Upload, Button, Progress, Alert, Typography, Space, Tag, Spin, Result
} from 'antd';
import {
  InboxOutlined, FileTextOutlined, FilePdfOutlined,
  FileWordOutlined, PictureOutlined, LoadingOutlined
} from '@ant-design/icons';
import { uploadResume } from '../services/api';

const { Dragger } = Upload;
const { Text, Title } = Typography;

const FILE_ICON = {
  pdf: <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 32 }} />,
  word: <FileWordOutlined style={{ color: '#1677ff', fontSize: 32 }} />,
  image: <PictureOutlined style={{ color: '#52c41a', fontSize: 32 }} />,
};

const ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.bmp,.webp,.tiff';

/**
 * 简历上传组件
 * Props:
 *   operator: string      — 当前操作人姓名
 *   onSuccess: (result) => void
 */
export default function ResumeUpload({ operator = '默认用户', onSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(''); // 'extracting' | 'parsing' | 'syncing'
  const [error, setError] = useState(null);

  const handleFile = useCallback(async (file) => {
    setError(null);
    setUploading(true);
    setProgress(10);
    setStage('extracting');

    try {
      // 模拟进度
      const ticker = setInterval(() => {
        setProgress(p => Math.min(p + 5, 85));
      }, 1200);

      setStage('parsing');
      const result = await uploadResume(file, operator);
      clearInterval(ticker);
      setProgress(100);
      setStage('syncing');

      setTimeout(() => {
        setUploading(false);
        setStage('');
        setProgress(0);
        if (onSuccess) onSuccess(result);
      }, 500);
    } catch (err) {
      setUploading(false);
      setProgress(0);
      setStage('');
      setError(err.message);
    }

    return false; // 阻止 antd 默认上传行为
  }, [operator, onSuccess]);

  const stageText = {
    extracting: '正在提取文件内容...',
    parsing: 'AI 解析字段中（最长约30s）...',
    syncing: '同步至知识库...',
  };

  return (
    <div>
      {!uploading && (
        <Dragger
          accept={ACCEPT}
          beforeUpload={handleFile}
          showUploadList={false}
          disabled={uploading}
          style={{ padding: '20px 0' }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ fontSize: 48, color: '#1677ff' }} />
          </p>
          <p className="ant-upload-text">
            点击选择或拖拽简历文件至此区域
          </p>
          <p className="ant-upload-hint">
            支持 PDF、Word (.docx/.doc)、图片 (JPG/PNG/BMP/TIFF/WEBP)，单文件最大 20MB
          </p>
          <div style={{ marginTop: 12 }}>
            <Space>
              {Object.entries(FILE_ICON).map(([type, icon]) => (
                <Tag key={type} icon={icon} style={{ padding: '4px 8px', fontSize: 13 }}>
                  {type.toUpperCase()}
                </Tag>
              ))}
            </Space>
          </div>
        </Dragger>
      )}

      {uploading && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 36 }} />} />
          <div style={{ marginTop: 16 }}>
            <Text strong>{stageText[stage] || '处理中...'}</Text>
            <Progress
              percent={progress}
              status="active"
              strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
              style={{ marginTop: 12 }}
            />
          </div>
        </div>
      )}

      {error && (
        <Alert
          type="error"
          message="上传或解析失败"
          description={error}
          showIcon
          style={{ marginTop: 12 }}
          closable
          onClose={() => setError(null)}
        />
      )}
    </div>
  );
}
