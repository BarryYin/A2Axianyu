#!/bin/bash
# A2A Xianyu 全流程 E2E 测试
# 用法: bash scripts/e2e-test.sh [base_url]
# 默认 base_url = http://localhost:3000

set -e

BASE_URL="${1:-http://localhost:3000}"
PASS=0
FAIL=0
COOKIE_JAR=$(mktemp -d)/cookies.txt

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { PASS=$((PASS+1)); echo -e "  ${GREEN}✓${NC} $1"; }
fail() { FAIL=$((FAIL+1)); echo -e "  ${RED}✗${NC} $1"; }
info() { echo -e "${YELLOW}→${NC} $1"; }

cleanup() {
  rm -rf "$(dirname "$COOKIE_JAR")"
}
trap cleanup EXIT

echo "=========================================="
echo " A2A Xianyu 全流程 E2E 测试"
echo " Base: $BASE_URL"
echo "=========================================="
echo ""

# ─────────────────────────────────────
# 1. 服务健康检查
# ─────────────────────────────────────
info "[1/8] 服务健康检查"

if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$BASE_URL" | grep -q "200\|30[0-9]"; then
  pass "服务器可达 ($BASE_URL)"
else
  fail "服务器不可达 ($BASE_URL) — 请先执行 npm run dev"
fi

# ─────────────────────────────────────
# 2. 获取商品列表 (无需登录)
# ─────────────────────────────────────
info "[2/8] 获取商品列表 (公开接口)"

RESP=$(curl -s "$BASE_URL/api/products")
CODE=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null || echo "")
if [ "$CODE" = "0" ]; then
  COUNT=$(echo "$RESP" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))" 2>/dev/null || echo "0")
  pass "商品列表获取成功 (${COUNT} 件)"
else
  fail "商品列表获取失败: $(echo "$RESP" | head -c 200)"
fi

# ─────────────────────────────────────
# 3. 注册测试用户
# ─────────────────────────────────────
info "[3/8] 注册测试用户"

TEST_PHONE="199$(date +%s | tail -c 9)"
TEST_PASS="test123456"
TEST_NICK="E2E测试_$(date +%H%M%S)"

REG_RESP=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$TEST_PHONE\",\"password\":\"$TEST_PASS\",\"nickname\":\"$TEST_NICK\"}")

REG_OK=$(echo "$REG_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',''))" 2>/dev/null || echo "")

if [ "$REG_OK" = "True" ] || [ "$REG_OK" = "true" ]; then
  pass "注册成功 ($TEST_PHONE → $TEST_NICK)"
else
  # 可能已存在
  REG_ERR=$(echo "$REG_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',''))" 2>/dev/null || echo "")
  if echo "$REG_ERR" | grep -q "已注册"; then
    pass "用户已存在 (跳过注册)"
  else
    fail "注册失败: $REG_RESP"
  fi
fi

# ─────────────────────────────────────
# 4. 登录获取 session
# ─────────────────────────────────────
info "[4/8] 登录"

LOGIN_RESP=$(curl -s -c "$COOKIE_JAR" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$TEST_PHONE\",\"password\":\"$TEST_PASS\"}")

LOGIN_OK=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',''))" 2>/dev/null || echo "")

if [ "$LOGIN_OK" = "True" ] || [ "$LOGIN_OK" = "true" ]; then
  USER_NAME=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['nickname'])" 2>/dev/null || echo "")
  pass "登录成功 ($USER_NAME)"
else
  fail "登录失败: $LOGIN_RESP"
fi

# ─────────────────────────────────────
# 5. 获取我的商品 (需登录)
# ─────────────────────────────────────
info "[5/8] 获取我的商品 (需认证)"

ME_RESP=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/me/products")
ME_CODE=$(echo "$ME_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null || echo "")

if [ "$ME_CODE" = "0" ]; then
  ME_COUNT=$(echo "$ME_RESP" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))" 2>/dev/null || echo "0")
  pass "我的商品获取成功 (${ME_COUNT} 件)"
elif echo "$ME_RESP" | grep -q "401"; then
  fail "认证失败 — session cookie 未生效"
else
  fail "我的商品获取失败: $(echo "$ME_RESP" | head -c 200)"
fi

# ─────────────────────────────────────
# 6. 发布商品 (需登录)
# ─────────────────────────────────────
info "[6/8] 发布商品 (需认证)"

CREATE_RESP=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/products" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"E2E测试商品_'$(date +%H%M%S)'",
    "description":"全流程E2E测试自动创建",
    "price":999,
    "category":"数码",
    "condition":"几乎全新",
    "minPrice":800
  }')

CREATE_CODE=$(echo "$CREATE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null || echo "")

if [ "$CREATE_CODE" = "0" ]; then
  PRODUCT_ID=$(echo "$CREATE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d.get('id',''))" 2>/dev/null || echo "")
  PRODUCT_TITLE=$(echo "$CREATE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['title'])" 2>/dev/null || echo "")
  pass "发布成功: $PRODUCT_TITLE (id=$PRODUCT_ID)"
else
  fail "发布失败: $(echo "$CREATE_RESP" | head -c 300)"
fi

# ─────────────────────────────────────
# 7. 获取我的待处理交易
# ─────────────────────────────────────
info "[7/8] 获取待处理交易"

PENDING_RESP=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/me/pending-deals")
PENDING_CODE=$(echo "$PENDING_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null || echo "")

if [ "$PENDING_CODE" = "0" ] || echo "$PENDING_RESP" | grep -q '"data"'; then
  pass "待处理交易查询成功"
else
  # 空数据也应该算成功
  if echo "$PENDING_RESP" | grep -q "200\|data\|\[\]"; then
    pass "待处理交易查询成功 (空)"
  else
    fail "待处理交易查询异常: $(echo "$PENDING_RESP" | head -c 200)"
  fi
fi

# ─────────────────────────────────────
# 8. 登出
# ─────────────────────────────────────
info "[8/8] 登出"

LOGOUT_RESP=$(curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST "$BASE_URL/api/auth/logout")
LOGOUT_OK=$(echo "$LOGOUT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',''))" 2>/dev/null || echo "")

if [ "$LOGOUT_OK" = "True" ] || [ "$LOGOUT_OK" = "true" ]; then
  pass "登出成功"
else
  fail "登出异常: $LOGOUT_RESP"
fi

# ─────────────────────────────────────
# 结果汇总
# ─────────────────────────────────────
echo ""
echo "=========================================="
TOTAL=$((PASS + FAIL))
echo " 结果: ${PASS}/${TOTAL} 通过"
if [ "$FAIL" -gt 0 ]; then
  echo -e " ${RED}$FAIL 项失败${NC}"
  echo "=========================================="
  exit 1
else
  echo -e " ${GREEN}全部通过! 🎉${NC}"
  echo "=========================================="
  exit 0
fi
