import React, { useState, useEffect } from 'react';
import {
  Drawer, Form, Input, Select, DatePicker, Button, Space, Typography,
  Tag, Divider, Alert, Switch, Row, Col, Tooltip, Badge
} from 'antd';
import {
  EditOutlined, SaveOutlined, PlusOutlined, QuestionCircleOutlined,
  CheckCircleOutlined, RobotOutlined, UserOutlined
} from '@ant-design/icons';
import { updateResumeFields, addFieldDefinition } from '../services/api';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

const CONFIDENCE_COLOR = (c) => {
  if (c >= 0.85) return 'success';
  if (c >= 0.5) return 'warning';
  return 'error';
};

/**
 * 解析结果展示 + 手动补充表单
 * Props:
 *   open: bool
 *   onClose: fn
 *   result: { resumeId, parseStatus, parseError, fields, missingFields, requireManualInput }
 *   operator: string
 *   onSaved: fn
 */
export default function ParseResultPanel({ open, onClose, result, operator = '默认用户', onSaved }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newFieldVisible, setNewFieldVisible] = useState(false);
  const [newFieldForm] = Form.useForm();

  const fields = result?.fields || [];
  const missingFields = result?.missingFields || [];
  const parseStatus = result?.parseStatus;

  // 将现有字段填入表单
  useEffect(() => {
    if (!open || !fields.length) return;
    const init = {};
    fields.forEach(f => {
      if (f.value !== null && f.value !== undefined) {
        init[f.key] = f.value;
      }
    });
    form.setFieldsValue(init);
    setSaved(false);
  }, [open, fields]);

  const handleSave = async () => {
    const values = form.getFieldsValue();
    const changed = Object.entries(values)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([key, value]) => ({ key, value: String(value) }));

    if (!changed.length) return;

    setSaving(true);
    try {
      await updateResumeFields(result.resumeId, changed, operator);
      setSaved(true);
      if (onSaved) onSaved();
    } catch (err) {
      alert('保存失败: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddField = async () => {
    const vals = await newFieldForm.validateFields();
    try {
      await addFieldDefinition(vals);
      newFieldForm.resetFields();
      setNewFieldVisible(false);
      alert('自定义字段已添加，刷新页面后生效');
    } catch (err) {
      alert('添加失败: ' + err.message);
    }
  };

  // 按类别分组字段
  const groups = {
    '基本信息': ['name', 'phone', 'email', 'gender', 'age', 'birth_date', 'home_city', 'current_city'],
    '教育背景': ['education', 'school', 'school_985', 'school_211', 'school_double_top', 'major', 'grad_year'],
    '职业信息': ['work_years', 'current_company', 'current_title', 'expected_salary', 'expected_city'],
    '能力标签': ['skills', 'certificates', 'languages'],
    '经历摘要': ['work_history', 'self_evaluation'],
  };

  const fieldMap = {};
  fields.forEach(f => { fieldMap[f.key] = f; });

  const renderField = (key) => {
    const f = fieldMap[key];
    if (!f) return null;
    const isMissing = missingFields.some(m => m.key === key);
    const isManual = f.is_manual;
    const conf = f.confidence || 0;

    return (
      <Col span={12} key={key} style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>{f.label}</Text>
          {isManual
            ? <Tooltip title="手动填写"><UserOutlined style={{ color: '#1677ff', fontSize: 11 }} /></Tooltip>
            : <Tooltip title={`AI置信度 ${Math.round(conf * 100)}%`}><RobotOutlined style={{ color: '#722ed1', fontSize: 11 }} /></Tooltip>
          }
          {isMissing && <Badge color="red" text={<Text type="danger" style={{ fontSize: 10 }}>待补充</Text>} />}
        </div>
        <Form.Item name={key} style={{ marginBottom: 0 }}>
          {key === 'school_985' || key === 'school_211' || key === 'school_double_top'
            ? <Select size="small" options={[{ value: '是', label: '是' }, { value: '否', label: '否' }]} />
            : key === 'gender'
            ? <Select size="small" options={[{ value: '男', label: '男' }, { value: '女', label: '女' }]} />
            : key === 'education'
            ? <Select size="small" options={['博士','硕士','本科','大专','中专','高中','其他'].map(v => ({ value: v, label: v }))} />
            : <Input size="small" placeholder={`请填写${f.label}`} />
          }
        </Form.Item>
      </Col>
    );
  };

  return (
    <Drawer
      title={
        <Space>
          <RobotOutlined />
          <span>简历解析结果</span>
          {parseStatus === 'success' && <Tag color="success">解析完成</Tag>}
          {parseStatus === 'partial' && <Tag color="warning">部分识别</Tag>}
          {parseStatus === 'failed' && <Tag color="error">解析失败</Tag>}
        </Space>
      }
      open={open}
      onClose={onClose}
      width={720}
      extra={
        <Space>
          <Button onClick={() => setNewFieldVisible(true)} icon={<PlusOutlined />} size="small">
            添加自定义字段
          </Button>
          <Button
            type="primary"
            icon={saved ? <CheckCircleOutlined /> : <SaveOutlined />}
            loading={saving}
            onClick={handleSave}
          >
            {saved ? '已保存并同步' : '保存补充内容'}
          </Button>
        </Space>
      }
    >
      {/* 缺失字段提示 */}
      {missingFields.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`以下 ${missingFields.length} 个关键字段未能识别，请手动补充`}
          description={
            <Space wrap>
              {missingFields.map(f => (
                <Tag key={f.key} color="orange">{f.label}</Tag>
              ))}
            </Space>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {parseStatus === 'failed' && (
        <Alert
          type="error"
          showIcon
          message="文件解析失败"
          description={result?.parseError || '文件可能已损坏或格式不支持，请手动填写关键信息'}
          style={{ marginBottom: 16 }}
        />
      )}

      <Form form={form} layout="vertical" size="small">
        {Object.entries(groups).map(([groupName, keys]) => {
          const groupFields = keys.filter(k => fieldMap[k]);
          if (!groupFields.length) return null;
          return (
            <div key={groupName}>
              <Divider orientation="left" style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
                {groupName}
              </Divider>
              <Row gutter={[8, 0]}>
                {groupFields.map(renderField)}
              </Row>
            </div>
          );
        })}

        {/* 渲染未分组的扩展字段 */}
        {(() => {
          const knownKeys = Object.values(groups).flat();
          const extraFields = fields.filter(f => !knownKeys.includes(f.key));
          if (!extraFields.length) return null;
          return (
            <>
              <Divider orientation="left" style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
                自定义扩展字段
              </Divider>
              <Row gutter={[8, 0]}>
                {extraFields.map(f => renderField(f.key))}
              </Row>
            </>
          );
        })()}
      </Form>

      {/* 添加自定义字段弹窗 */}
      {newFieldVisible && (
        <div style={{ marginTop: 24, padding: 16, border: '1px dashed #d9d9d9', borderRadius: 8 }}>
          <Title level={5} style={{ marginBottom: 12 }}>添加自定义字段定义</Title>
          <Form form={newFieldForm} layout="inline" size="small">
            <Form.Item name="field_key" label="字段Key" rules={[{ required: true }]}>
              <Input placeholder="如 linkedin_url" style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="field_label" label="显示名" rules={[{ required: true }]}>
              <Input placeholder="如 领英地址" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="field_type" label="类型">
              <Select defaultValue="text" style={{ width: 90 }} options={[
                { value: 'text', label: '文本' },
                { value: 'select', label: '下拉' },
                { value: 'date', label: '日期' },
                { value: 'boolean', label: '布尔' },
              ]} />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" size="small" onClick={handleAddField}>确认添加</Button>
                <Button size="small" onClick={() => setNewFieldVisible(false)}>取消</Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
      )}
    </Drawer>
  );
}
