# Cloudflare Pages 部署教程

本教程将指导您如何将 SHORTSTORIES.APP 网站部署到 Cloudflare Pages。

## 前置准备

1. **Cloudflare 账户**：确保您已注册 Cloudflare 账户
2. **域名**：您的域名 `SHORTSTORIES.APP` 应该已经添加到 Cloudflare
3. **GitHub 仓库**：将代码上传到 GitHub 仓库

## 步骤 1：准备代码仓库

### 1.1 创建 GitHub 仓库
1. 登录 GitHub，创建新仓库 `shortstories-app`
2. 将本地代码推送到仓库：

```bash
cd test-website
git init
git add .
git commit -m "Initial commit for SHORTSTORIES.APP"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/shortstories-app.git
git push -u origin main
```

### 1.2 确认文件结构
确保您的仓库包含以下文件：
```
test-website/
├── functions/
│   └── api/
│       ├── publish/
│       │   └── story.js
│       ├── stories.js
│       └── story/
│           └── [id].js
├── public/
│   ├── _redirects
│   ├── index.html
│   └── story.html
├── package.json
├── wrangler.toml
└── server.js
```

## 步骤 2：创建 Cloudflare KV 命名空间

### 2.1 创建 KV 命名空间
1. 登录 Cloudflare Dashboard
2. 选择您的账户
3. 进入 "Workers & Pages" → "KV"
4. 点击 "Create a namespace"
5. 命名为 `STORIES_DATA`
6. 记录生成的 Namespace ID

### 2.2 创建预览命名空间
1. 再次创建一个命名空间
2. 命名为 `STORIES_DATA_PREVIEW`
3. 记录预览 Namespace ID

## 步骤 3：配置 Cloudflare Pages

### 3.1 创建 Pages 项目
1. 在 Cloudflare Dashboard 中，进入 "Workers & Pages"
2. 点击 "Create application"
3. 选择 "Pages" 标签
4. 点击 "Connect to Git"
5. 选择您的 GitHub 仓库 `shortstories-app`

### 3.2 配置构建设置
在项目设置中配置：
- **Framework preset**: None
- **Build command**: `npm run build`
- **Build output directory**: `public`
- **Root directory**: `/` (如果代码在根目录)

### 3.3 配置环境变量
在 "Settings" → "Environment variables" 中添加：
- `ENVIRONMENT`: `production`
- `DOMAIN`: `shortstories.app`

### 3.4 绑定 KV 命名空间
在 "Settings" → "Functions" → "KV namespace bindings" 中添加：
- **Variable name**: `STORIES_KV`
- **KV namespace**: 选择之前创建的 `STORIES_DATA`
- **Preview namespace**: 选择 `STORIES_DATA_PREVIEW`

## 步骤 4：配置自定义域名

### 4.1 添加自定义域名
1. 在 Pages 项目中，进入 "Custom domains"
2. 点击 "Set up a custom domain"
3. 输入 `shortstories.app`
4. 点击 "Continue"
5. 按照提示配置 DNS 记录

### 4.2 配置 DNS 记录
在 Cloudflare DNS 设置中添加：
- **Type**: CNAME
- **Name**: `@` (或 `shortstories.app`)
- **Target**: `your-pages-project.pages.dev`
- **Proxy status**: Proxied (橙色云朵)

### 4.3 添加 www 子域名（可选）
- **Type**: CNAME
- **Name**: `www`
- **Target**: `shortstories.app`
- **Proxy status**: Proxied

## 步骤 5：部署和测试

### 5.1 触发部署
1. 推送代码到 GitHub 仓库会自动触发部署
2. 在 Cloudflare Pages Dashboard 中查看部署状态
3. 等待部署完成（通常需要 1-3 分钟）

### 5.2 测试 API 端点
部署完成后，测试以下端点：

```bash
# 测试故事列表 API
curl https://shortstories.app/api/stories

# 测试发布 API（需要有效的 token）
curl -X POST https://shortstories.app/api/publish/story \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试故事",
    "content": "这是一个测试故事的内容...",
    "author": "测试作者",
    "category": "Fiction",
    "publishType": "fullstory",
    "token": "your-test-token"
  }'
```

### 5.3 测试网站访问
1. 访问 `https://shortstories.app` 查看主页
2. 确认故事列表正常显示
3. 测试故事详情页面

## 步骤 6：Flutter App 配置验证

确认 Flutter app 中的 `lib/services/publish_service.dart` 文件已更新：
```dart
static const String publishApiUrl = 'https://shortstories.app/api/publish/story';
```

## 故障排除

### 常见问题

1. **API 请求失败**
   - 检查 CORS 配置
   - 确认 KV 命名空间绑定正确
   - 查看 Functions 日志

2. **域名无法访问**
   - 确认 DNS 记录配置正确
   - 等待 DNS 传播（最多 24 小时）
   - 检查 SSL 证书状态

3. **部署失败**
   - 检查构建日志
   - 确认 package.json 配置正确
   - 验证文件路径和权限

### 查看日志
1. 在 Cloudflare Dashboard 中进入您的 Pages 项目
2. 点击 "Functions" 标签
3. 查看实时日志和错误信息

## 维护和更新

### 更新代码
1. 修改本地代码
2. 提交并推送到 GitHub
3. Cloudflare Pages 会自动重新部署

### 监控和分析
1. 使用 Cloudflare Analytics 查看访问统计
2. 监控 API 请求和错误率
3. 定期备份 KV 数据

## 安全建议

1. **API 安全**
   - 实施适当的认证机制
   - 限制请求频率
   - 验证输入数据

2. **域名安全**
   - 启用 HTTPS（Cloudflare 自动提供）
   - 配置安全头部
   - 定期更新依赖

## 成本估算

- **Cloudflare Pages**: 免费计划支持无限静态请求
- **Cloudflare Functions**: 免费计划每天 100,000 次请求
- **KV 存储**: 免费计划支持 1GB 存储和每天 100,000 次读取

对于中小型应用，免费计划通常足够使用。

---

**部署完成后，您的 SHORTSTORIES.APP 将完全运行在 Cloudflare 的全球网络上，享受快速的加载速度和高可用性！**