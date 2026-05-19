#!/usr/bin/env bash
# 一键启动脚本（开发模式）

echo "========================================="
echo "  简历解析 Agent - 启动中"
echo "========================================="

# 后端依赖
echo "[1/4] 安装后端依赖..."
cd backend && npm install --legacy-peer-deps

# 复制 .env（如果不存在）
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  ⚠️  已生成 backend/.env，请填入真实 AI API Key"
fi

# 前端依赖
echo "[2/4] 安装前端依赖..."
cd ../frontend && npm install --legacy-peer-deps

# 并行启动
echo "[3/4] 启动后端服务 (端口 3001)..."
cd ../backend && npm run dev &
BACKEND_PID=$!

echo "[4/4] 启动前端服务 (端口 3000)..."
cd ../frontend && npm start &
FRONTEND_PID=$!

echo ""
echo "✅ 服务已启动："
echo "   前端: http://localhost:3000"
echo "   后端: http://localhost:3001/api/health"
echo ""
echo "按 Ctrl+C 停止所有服务"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
