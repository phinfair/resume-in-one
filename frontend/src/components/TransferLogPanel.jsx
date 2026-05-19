import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Tag, Space, Input, Select, Button, DatePicker, Typography,
  Tooltip, Badge, Card, Statistic, Row, Col
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, UploadOutlined,
  EditOutlined, SyncOutlined, FileDoneOutlined, UserOutlined
} from '@ant-design/icons';
import { listTransferLogs, getTransferStats } from '../services/api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const ACTION_CONFIG = {
  upload:      { label: '上传', color: 'blue',    icon: <UploadOutlined /> },
  parse:       { label: 'AI解析', color: 'purple', icon: <FileDoneOutlined /> },
  manual_edit: { label: '手动补充', color: 'orange', icon: <EditOutlined /> },
  kb_sync:     { label: '知识库同步', color: 'green', icon: <SyncOutlined /> },
};

const PAGE_SIZE = 20;

/**
 * 传输记录面板组件
 */
export default function TransferLogPanel() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  // 筛选条件
  const [operator, setOperator] = useState('');
  const [action, setAction] = useState('');
  const [dateRange, setDateRange] = useState(null);

  const fetchLogs = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, pageSize: PAGE_SIZE };
      if (operator) params.operator = operator;
      if (action) params.action = action;
      if (dateRange) {
        params.dateFrom = dateRange[0].format('YYYY-MM-DD');
        params.dateTo = dateRange[1].format('YYYY-MM-DD');
      }
      const res = await listTransferLogs(params);
      setLogs(res.data || []);
      setTotal(res.total || 0);
      setPage(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [operator, action, dateRange]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await getTransferStats();
      setStats(res);
    } catch {}
  }, []);

  useEffect(() => {
    fetchLogs(1);
    fetchStats();
  }, []);

  // 统计卡片
  const actionTotals = {};
  if (stats?.byAction) {
    stats.byAction.forEach(r => {
      actionTotals[r.action] = (actionTotals[r.action] || 0) + r.count;
    });
  }

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 160,
      render: v => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
      defaultSortOrder: 'descend',
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      width: 100,
      render: v => (
        <Space>
          <UserOutlined style={{ color: '#1677ff' }} />
          <Text>{v || '匿名'}</Text>
        </Space>
      ),
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      width: 110,
      render: v => {
        const cfg = ACTION_CONFIG[v] || { label: v, color: 'default' };
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      title: '文件名',
      dataIndex: 'file_name',
      ellipsis: true,
      render: (v, r) => v ? (
        <Space>
          <Tag>{(r.file_type || '').toUpperCase()}</Tag>
          <Tooltip title={v}><Text style={{ maxWidth: 160 }} ellipsis>{v}</Text></Tooltip>
        </Space>
      ) : <Text type="secondary">-</Text>,
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      width: 90,
      render: v => v ? `${(v / 1024).toFixed(1)} KB` : '-',
    },
    {
      title: '简历ID',
      dataIndex: 'resume_id',
      width: 120,
      render: v => v ? <Text code style={{ fontSize: 11 }}>{v.slice(0, 8)}...</Text> : '-',
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      width: 120,
      render: v => <Text type="secondary" style={{ fontSize: 12 }}>{v || '-'}</Text>,
    },
    {
      title: '详情',
      dataIndex: 'detail',
      render: v => v ? (
        <Tooltip title={JSON.stringify(v, null, 2)}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {typeof v === 'object' ? Object.keys(v).join(', ') : v}
          </Text>
        </Tooltip>
      ) : null,
    },
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {Object.entries(ACTION_CONFIG).map(([key, cfg]) => (
          <Col span={6} key={key}>
            <Card size="small" bordered>
              <Statistic
                title={cfg.label + '次数（近30天）'}
                value={actionTotals[key] || 0}
                prefix={cfg.icon}
                valueStyle={{ color: key === 'upload' ? '#1677ff' : key === 'parse' ? '#722ed1' : key === 'manual_edit' ? '#fa8c16' : '#52c41a' }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 筛选栏 */}
      <Space style={{ marginBottom: 12 }} wrap>
        <Input
          prefix={<SearchOutlined />}
          placeholder="操作人搜索"
          value={operator}
          onChange={e => setOperator(e.target.value)}
          style={{ width: 160 }}
          allowClear
        />
        <Select
          placeholder="操作类型"
          value={action || undefined}
          onChange={setAction}
          style={{ width: 140 }}
          allowClear
          options={Object.entries(ACTION_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
        />
        <RangePicker
          value={dateRange}
          onChange={setDateRange}
          style={{ width: 240 }}
        />
        <Button type="primary" onClick={() => fetchLogs(1)}>查询</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { setOperator(''); setAction(''); setDateRange(null); setTimeout(() => fetchLogs(1), 100); }}>重置</Button>
      </Space>

      <Table
        rowKey="id"
        dataSource={logs}
        columns={columns}
        loading={loading}
        size="small"
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total,
          showSizeChanger: false,
          showTotal: t => `共 ${t} 条记录`,
          onChange: p => fetchLogs(p),
        }}
        scroll={{ x: 900 }}
      />
    </div>
  );
}
