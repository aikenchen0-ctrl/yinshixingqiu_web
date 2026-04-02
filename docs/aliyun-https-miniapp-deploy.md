# 阿里云 HTTPS 部署与小程序接入

这份文档用于把当前项目接到阿里云测试环境，并让微信小程序真机可以正常请求后端。

## 域名建议

- 测试域名优先：`xuyinx.cn`
- 测试域名备选：`xueyin.net.cn`
- 正式域名：`www.guanxingyun.com`

小程序真机只认 `https` 合法域名，不认 `localhost`、局域网 IP，也不认 `http`。

## 一、服务器准备

建议环境：

- Alibaba Cloud ECS
- Ubuntu 22.04 LTS
- Node.js 20+
- PostgreSQL 16
- Nginx
- PM2

项目目录建议：

```bash
/var/www/xueyin
├─ backend
└─ admin-web
```

## 二、域名解析

以 `xuyinx.cn` 为例：

1. 在阿里云域名控制台添加 A 记录
2. 主机记录填 `@`
3. 记录值填 ECS 公网 IP
4. TTL 用默认值

正式域名如果用 `www.guanxingyun.com`：

1. `@` 解析到 ECS 公网 IP
2. `www` 也解析到 ECS 公网 IP

## 三、后端部署

进入服务器后准备目录：

```bash
mkdir -p /var/www/xueyin
mkdir -p /var/log/xueyin
```

把仓库代码上传到：

```bash
/var/www/xueyin/backend
```

安装依赖：

```bash
cd /var/www/xueyin/backend
npm install
npx prisma generate
```

复制生产环境变量：

```bash
cp .env.production.example .env
```

然后编辑 `.env`：

```env
NODE_ENV="production"
HOST="127.0.0.1"
PORT="3000"
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/xueyin?schema=public"
WECHAT_APP_ID="wxe2d0484c74a647ef"
WECHAT_APP_SECRET="替换成正式小程序密钥"
```

推数据库结构：

```bash
npx prisma db push
node scripts/seedDemoData.js
```

## 四、PM2 启动

全局安装 PM2：

```bash
npm install -g pm2
```

当前仓库已提供配置文件：

- [backend/ecosystem.config.cjs](/D:/CodeDevelopment/xueyinMiniapp/backend/ecosystem.config.cjs)

服务器上执行：

```bash
cd /var/www/xueyin/backend
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

查看日志：

```bash
pm2 logs xueyin-backend
```

## 五、Nginx 反向代理

仓库中已提供 3 份配置模板：

- [backend/deploy/nginx.xuyinx.cn.conf](/D:/CodeDevelopment/xueyinMiniapp/backend/deploy/nginx.xuyinx.cn.conf)
- [backend/deploy/nginx.xueyin.net.cn.conf](/D:/CodeDevelopment/xueyinMiniapp/backend/deploy/nginx.xueyin.net.cn.conf)
- [backend/deploy/nginx.guanxingyun.com.conf](/D:/CodeDevelopment/xueyinMiniapp/backend/deploy/nginx.guanxingyun.com.conf)

以 `xuyinx.cn` 为例：

```bash
cp /var/www/xueyin/backend/deploy/nginx.xuyinx.cn.conf /etc/nginx/conf.d/xuyinx.cn.conf
nginx -t
systemctl reload nginx
```

## 六、HTTPS 证书

推荐两种方式：

1. 阿里云数字证书服务签发并下载证书
2. 用 `acme.sh` / Let's Encrypt 自动签发

证书放置建议：

```bash
/etc/nginx/ssl/xuyinx.cn/fullchain.pem
/etc/nginx/ssl/xuyinx.cn/privkey.pem
```

拿到证书后：

```bash
nginx -t
systemctl reload nginx
```

验证：

```bash
curl https://xuyinx.cn/health
```

返回类似：

```json
{
  "ok": true,
  "service": "xueyin-backend"
}
```

## 七、微信小程序后台配置

登录微信公众平台后，在小程序后台配置 request 合法域名。

测试环境建议先配置：

- `https://xuyinx.cn`

如果你要切到备选域名，再加：

- `https://xueyin.net.cn`

正式环境配置：

- `https://www.guanxingyun.com`

注意：

- 只能填域名，不能填路径
- 必须是 `https`
- 不能填 IP
- 不能填 `localhost`

## 八、小程序当前行为

当前小程序请求地址优先级已经配置好：

1. `https://xuyinx.cn`
2. `https://xueyin.net.cn`
3. `https://www.guanxingyun.com`
4. `http://127.0.0.1:3000`
5. `http://192.168.31.124:3000`

对应文件：

- [miniprogram/utils/request.ts](/D:/CodeDevelopment/xueyinMiniapp/miniprogram/utils/request.ts)

所以只要测试域名部署完成并配置进微信后台，真机就会优先走 HTTPS 域名。

## 九、上线前检查

- `https://域名/health` 可访问
- Nginx 证书生效
- `pm2 logs xueyin-backend` 无报错
- 小程序后台 request 合法域名已配置
- 真机登录页“后端状态”显示可访问
- 真机点击登录后，后端日志能看到 `POST /api/auth/login`

## 十、当前最短落地顺序

1. 先用 `xuyinx.cn` 部署测试环境
2. 真机把登录和注册跑通
3. 跑通后再切正式域名 `www.guanxingyun.com`
