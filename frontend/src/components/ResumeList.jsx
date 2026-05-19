import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Tag, Space, Input, Button, Typography, Tooltip, Badge,
  Drawer, Descriptions, Modal, Row, Col, Card, Statistic
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, EyeOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons';
import { listResumes, getResume } from '../services/api';
import ParseResultPanel from './ParseResultPanel';
import dayjs from 'dayjs';

const { Text } = Typography;

const STATUS_CONFIG = {
  success: { label: '解析成功', color: 'success', icon: <CheckCircleOutlined /> },
  partial: { label: '部分识别', color: 'warning', icon: <ExclamationCircleOutlined /> },
  failed:  { label: '解析失败', color: 'error',   icon: <CloseCircleOutlined /> },
  pending: { label: '待解析',   color: 'default', icon: null },
};

/**
 * 简历列表页
 * Props: operator
 */
export default function ResumeList({ operator = '默认用户' }) {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editResult, setEditResult] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  const fetchList = useCallback(async (p = 1, q = search) => {
    setLoading(true);
    try {
      const res = await listResumes({ page: p, pageSize: 20, search: q });
      setList(res.data || []);
      setTotal(res.total || 0);
      setPage(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchList(1); }, []);

  const handleView = async (id) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const res = await getResume(id);
      setDetailData(res.resume);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleEdit = async (id) => {
    setDetailLoading(true);
    try {
      const res = await getResume(id);
      setEditResult({
        resumeId: id,
        parseStatus: res.resume.parse_status,
        parseError: res.resume.parse_error,
        fields: res.resume.fields,
        missingFields: [],
        requireManualInput: true,
      });
      setEditOpen(true);
    } catch {}
    setDetailLoading(false);
  };

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      width: 90,
      render: v => <Text strong>{v || <Text type="secondary">未识别</Text>}</Text>,
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      width: 120,
      render: v => v || <Text type="secondary">-</Text>,
    },
    {
      title: '毕业院校',
      dataIndex: 'school',
      ellipsis: true,
      render: (v, r) => (
        <Space size={4}>
          <Text>{v || <Text type="secondary">-</Text>}</Text>
          {r.is_985 === '是' && <Tag color="red" style={{ fontSize: 10, padding: '0 4px' }}>985</Tag>}
          {r.is_211 === '是' && <Tag color="volcano" style={{ fontSize: 10, padding: '0 4px' }}>211</Tag>}
        </Space>
      ),
    },
    {
      title: '文件类型',
      dataIndex: 'file_type',
      width: 80,
      render: v => {
        const colorMap = { pdf: 'red', word: 'blue', image: 'green' };
        return <Tag color={colorMap[v] || 'default'}>{(v || '').toUpperCase()}</Tag>;
      },
    },
    {
      title: '解析状态',
      dataIndex: 'parse_status',
      width: 100,
      render: v => {
        const cfg = STATUS_CONFIG[v] || STATUS_CONFIG.pending;
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      width: 150,
      render: v => dayjs(v).format('MM-DD HH:mm'),
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
      defaultSortOrder: 'descend',
    },
    {
      title: '操作',
      width: 120,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleView(r.id)}>查看</Button>
          <Button size="small" type="link" onClick={() => handleEdit(r.id)}>补充</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索姓名/技能/学校..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onPressEnter={() => fetchList(1)}
          style={{ width: 240 }}
          allowClear
        />
        <Button type="primary" onClick={() => fetchList(1)}>搜索</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); fetchList(1, ''); }}>刷新</Button>
        <Text type="secondary">共 {total} 份简历</Text>
      </Space>

      <Table
        rowKey="id"
        dataSource={list}
        columns={columns}
        loading={loading}
        size="small"
        pagination={{
          current: page,
          pageSize: 20,
          total,
          showTotal: t => `共 ${t} 份`,
          onChange: p => fetchList(p),
        }}
        scroll={{ x: 800 }}
      />

      {/* 详情 Drawer */}
      <Drawer
        title="简历详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={640}
        loading={detailLoading}
      >
        {detailData && (
          <Descriptions bordered column={2} size="small">
            {(detailData.fields || []).map(f => (
              <Descriptions.Item
                key={f.key}
                label={
                  <Space size={4}>
                    <Text>{f.label}</Text>
                    {f.is_manual ? <Tag color="blue" style={{ fontSize: 10 }}>手动</Tag>
                      : f.confidence >= 0.85 ? <Tag color="green" style={{ fontSize: 10 }}>高置信</Tag>
                      : f.confidence > 0 ? <Tag color="orange" style={{ fontSize: 10 }}>低置信</Tag>
                      : null
                    }
                  </Space>
                }
              >
                {f.value || <Text type="secondary">-</Text>}
              </Descriptions.Item>
            ))}
          </Descriptions>
        )}
      </Drawer>

      {/* 手动补充 Drawer */}
      {editResult && (
        <ParseResultPanel
          open={editOpen}
          onClose={() => setEditOpen(false)}
          result={editResult}
          operator={operator}
          onSaved={() => { setEditOpen(false); fetchList(page); }}
        />
      )}
    </div>
  );
}
