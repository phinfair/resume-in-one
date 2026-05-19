import React, { useState } from 'react';
import {
  Layout, Menu, Typography, Space, Input, Avatar, ConfigProvider
} from 'antd';
import {
  CloudUploadOutlined, UnorderedListOutlined,
  HistoryOutlined, RobotOutlined, UserOutlined
} from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import 'dayjs/locale/zh-cn';
import dayjs from 'dayjs';
import ResumeUpload from '../components/ResumeUpload';
import ParseResultPanel from '../components/ParseResultPanel';
import ResumeList from '../components/ResumeList';
import TransferLogPanel from '../components/TransferLogPanel';

dayjs.locale('zh-cn');

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const MENU_ITEMS = [
  { key: 'upload', icon: <CloudUploadOutlined />, label: '上传解析' },
  { key: 'list',   icon: <UnorderedListOutlined />, label: '简历库' },
  { key: 'logs',   icon: <HistoryOutlined />, label: '传输记录' },
];

export default function MainPage() {
  const [activeKey, setActiveKey] = useState('upload');
  const [operator, setOperator] = useState(localStorage.getItem('resume_operator') || '');
  const [parseResult, setParseResult] = useState(null);
  const [resultOpen, setResultOpen] = useState(false);

  const handleOperatorChange = (e) => {
    const v = e.target.value;
    setOperator(v);
    localStorage.setItem('resume_operator', v);
  };

  const handleUploadSuccess = (result) => {
    setParseResult(result);
    setResultOpen(true);
  };

  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1677ff' } }}>
      <Layout style={{ minHeight: '100vh' }}>
        {/* 顶部 */}
        <Header style={{
          background: 'linear-gradient(135deg, #1677ff 0%, #722ed1 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px',
        }}>
          <Space>
            <RobotOutlined style={{ fontSize: 24, color: '#fff' }} />
            <Title level={4} style={{ color: '#fff', margin: 0 }}>
              简历解析 Agent
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
              AI 驱动 · 智能识别 · 自动归档
            </Text>
          </Space>
          <Space>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>操作人：</Text>
            <Input
              prefix={<UserOutlined />}
              placeholder="输入您的姓名"
              value={operator}
              onChange={handleOperatorChange}
              style={{ width: 160 }}
              size="small"
            />
          </Space>
        </Header>

        <Layout>
          {/* 左侧导航 */}
          <Sider width={180} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
            <Menu
              mode="inline"
              selectedKeys={[activeKey]}
              items={MENU_ITEMS}
              onClick={({ key }) => setActiveKey(key)}
              style={{ height: '100%', borderRight: 0, paddingTop: 8 }}
            />
          </Sider>

          {/* 主内容区 */}
          <Content style={{ padding: '24px', background: '#f5f7fa', minHeight: 'calc(100vh - 64px)' }}>
            {activeKey === 'upload' && (
              <div style={{ maxWidth: 760, margin: '0 auto' }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <Title level={5} style={{ marginBottom: 16 }}>
                    <CloudUploadOutlined style={{ marginRight: 8 }} />
                    上传简历文件
                  </Title>
                  <ResumeUpload operator={operator || '匿名用户'} onSuccess={handleUploadSuccess} />
                </div>

                <div style={{ marginTop: 16, background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <Title level={5} style={{ marginBottom: 12 }}>解析能力说明</Title>
                  <ul style={{ color: '#666', lineHeight: 2 }}>
                    <li>支持 <strong>PDF / Word (.docx/.doc) / 图片</strong>（JPG/PNG/BMP/TIFF/WebP）</li>
                    <li>自动识别 <strong>985/211/双一流</strong> 院校标签</li>
                    <li>提取 <strong>25+ 关键字段</strong>，支持自定义扩展字段</li>
                    <li>无法识别的字段提示手动补充，补充内容<strong>自动同步</strong>至数据库及知识库</li>
                    <li>每次操作留存<strong>传输记录</strong>（操作人、时间、文件类型）</li>
                  </ul>
                </div>
              </div>
            )}

            {activeKey === 'list' && (
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <Title level={5} style={{ marginBottom: 16 }}>
                  <UnorderedListOutlined style={{ marginRight: 8 }} />
                  简历库
                </Title>
                <ResumeList operator={operator || '匿名用户'} />
              </div>
            )}

            {activeKey === 'logs' && (
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <Title level={5} style={{ marginBottom: 16 }}>
                  <HistoryOutlined style={{ marginRight: 8 }} />
                  传输记录
                </Title>
                <TransferLogPanel />
              </div>
            )}
          </Content>
        </Layout>
      </Layout>

      {/* 解析结果侧边栏 */}
      <ParseResultPanel
        open={resultOpen}
        onClose={() => setResultOpen(false)}
        result={parseResult}
        operator={operator || '匿名用户'}
        onSaved={() => { setResultOpen(false); setActiveKey('list'); }}
      />
    </ConfigProvider>
  );
}
