# `xueyin.net.cn` 官网静态部署

目标：

- `xueyin.net.cn` 根路径提供静态官网
- `xueyinx.cn` 继续承载小程序后端
- `xueyin.net.cn/boss/` 保留现有反向代理能力

## 目录约定

服务器目录：

```bash
/var/www/xueyin
├─ backend
└─ official_website
```

本地静态站目录：

```bash
/home/youshaocong/hgfs/xueyinMiniapp/official_website
```

## 1. 上传静态文件

如果本机可以直接 SSH 到服务器：

```bash
ssh Mayn@192.168.31.123 'mkdir -p /var/www/xueyin/official_website'
rsync -av --delete /home/youshaocong/hgfs/xueyinMiniapp/official_website/ Mayn@192.168.31.123:/var/www/xueyin/official_website/
```

至少要保证服务器上存在这些文件：

```bash
/var/www/xueyin/official_website/index.html
/var/www/xueyin/official_website/assets/hero-network.svg
/var/www/xueyin/official_website/assets/alliance-network.svg
/var/www/xueyin/official_website/assets/research-archive.svg
```

## 2. 安装 Nginx 站点配置

仓库模板文件：

```bash
/var/www/xueyin/backend/deploy/nginx.xueyin.net.cn.conf
```

模板当前行为：

- `http://xueyin.net.cn` 自动跳到 HTTPS
- `https://xueyin.net.cn/boss/` 反代到 `127.0.0.1:8081`
- `https://xueyin.net.cn/` 根路径直接读取 `/var/www/xueyin/official_website`
- `https://xueyin.net.cn/api/*` 直接返回 `404`

安装命令：

```bash
sudo cp /var/www/xueyin/backend/deploy/nginx.xueyin.net.cn.conf /etc/nginx/conf.d/xueyin.net.cn.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 3. HTTPS 证书

Nginx 模板默认读取：

```bash
/etc/nginx/ssl/xueyin.net.cn/fullchain.pem
/etc/nginx/ssl/xueyin.net.cn/privkey.pem
```

如果 Cloudflare 打开了代理并且访问 `https://xueyin.net.cn` 返回 `525`，通常说明：

- 源站没有 `xueyin.net.cn` 证书
- 证书路径不对
- 证书内容和域名不匹配
- Nginx 没有正确加载新证书

证书就绪后执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 4. 验证

服务器本机验证：

```bash
curl -I http://127.0.0.1
curl -Ik --resolve xueyin.net.cn:443:127.0.0.1 https://xueyin.net.cn
```

外部验证：

```bash
curl -I http://xueyin.net.cn
curl -Ik https://xueyin.net.cn
curl -Ik https://xueyin.net.cn/boss/
curl -Ik https://xueyinx.cn/health
```

期望结果：

- `http://xueyin.net.cn` 返回 `301/302` 到 HTTPS
- `https://xueyin.net.cn` 返回 `200`
- `https://xueyin.net.cn/boss/` 按现有服务返回
- `https://xueyinx.cn/health` 继续正常

## 5. 注意事项

- 不要把 `xueyin.net.cn` 再代理到 `127.0.0.1:3000`，否则会和官网静态站目标冲突
- 小程序后端域名继续使用 `xueyinx.cn`
- 如果 Cloudflare 使用 Full 或 Full (strict)，源站必须有可用证书
