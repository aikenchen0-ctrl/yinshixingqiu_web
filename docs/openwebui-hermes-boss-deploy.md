# xueyin.net.cn `/boss` 閮ㄧ讲鏂规

杩欎釜鏂规鎶?`xueyin.net.cn/boss` 鐩存帴浣滀负 `Open WebUI + Hermes Agent` 鐨勪細璇濆叆鍙ｃ€?
閫傜敤鍦烘櫙锛?
- 浣跨敤浜烘暟涓嶈秴杩?10 浜?- 闇€瑕佹垚鐔熻亰澶?UI锛岃€屼笉鏄嚜鐮斿墠绔?- 闇€瑕?Hermes Agent 鐨?terminal銆乫ile ops銆亀eb search銆乵emory銆乻kills 鑳藉姏

## 缁撴瀯

娴忚鍣ㄨ闂摼璺細

1. 鐢ㄦ埛璁块棶 `https://xueyin.net.cn/boss`
2. Nginx 鎶?`/boss/` 鍙嶄唬鍒版湰鏈?`127.0.0.1:8081`
3. `Open WebUI` 瀹瑰櫒鎻愪緵鑱婂ぉ鐣岄潰
4. `Open WebUI` 閫氳繃 OpenAI 鍏煎鎺ュ彛杞彂鍒板涓绘満涓婄殑 `Hermes Agent Gateway`
5. Hermes 璐熻矗瀹為檯 agent 鎵ц涓?skill 璋冪敤

## 宸茶ˉ濂界殑鏂囦欢

- `backend/deploy/docker-compose.openwebui-hermes.yml`
- `backend/deploy/docker-compose.openwebui-hermes-docker.yml`
- `backend/deploy/.env.openwebui-hermes.example`
- `backend/deploy/.env.openwebui-hermes-docker.example`
- `backend/deploy/hermes-gateway@.service`
- `backend/deploy/hermes-gateway.Dockerfile`
- `backend/deploy/nginx.xueyin.net.cn.conf`
- `backend/deploy/prepare-openwebui-hermes-env.sh`
- `backend/deploy/prepare-openwebui-hermes-env.ps1`
- `backend/deploy/check-openwebui-hermes.sh`

## 1. 瀹夎骞跺惎鍔?Hermes Agent

Hermes 鐨勫畼鏂规帴娉曟槸寮€鍚?API Server锛岀劧鍚庡惎鍔?gateway銆?
鍙傝€冨畼鏂规枃妗ｏ細

- Hermes Agent 鎺?Open WebUI锛?  https://docs.openwebui.com/getting-started/quick-start/connect-an-agent/hermes-agent/

鏈€鐪佷簨鐨勬柟寮忔槸鐩存帴鐢熸垚 `~/.hermes/.env` 鍜?`backend/deploy/.env.openwebui-hermes`锛?
```bash
cd backend
npm run deploy:boss:prepare
```

濡傛灉浣犳兂鎵嬪伐鎺у埗鍙橀噺锛屽啀鎸変笅闈㈢殑鏍煎紡鍑嗗 `~/.hermes/.env`锛?
```env
API_SERVER_ENABLED=true
API_SERVER_KEY=replace-with-a-strong-random-string
API_SERVER_HOST=127.0.0.1
API_SERVER_PORT=8642
```

鐒跺悗鍚姩锛?
```bash
hermes gateway
```

濡傛灉瑕佸仛鎴愬父椹绘湇鍔★細

```bash
sudo cp backend/deploy/hermes-gateway@.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hermes-gateway@YOUR_USER
```

## 2. 鍚姩 Open WebUI

濡傛灉宸茬粡鎵ц杩?`npm run deploy:boss:prepare`锛岃繖涓€鑺傚彲浠ョ洿鎺ヨ烦杩囥€?
鎵嬪伐鏂瑰紡濡備笅銆?
澶嶅埗鐜鏂囦欢锛?
```bash
cd backend/deploy
cp .env.openwebui-hermes.example .env.openwebui-hermes
```

鑷冲皯瑕佹敼杩欏嚑椤癸細

- `WEBUI_ADMIN_PASSWORD`
- `WEBUI_SECRET_KEY`
- `OPENAI_API_KEY`

杩欓噷鐨?`OPENAI_API_KEY` 涓嶆槸 OpenAI key锛岃€屾槸 Hermes 鐨?`API_SERVER_KEY`銆?`WEBUI_SECRET_KEY` 瑕佺敤涓€涓查暱鏈熷浐瀹氱殑闅忔満鍊硷紝涓嶈兘鐣欑┖銆?
鍚姩锛?
```bash
cd backend/deploy
docker compose -f docker-compose.openwebui-hermes.yml up -d
```

## 3. 鎸傚埌 `xueyin.net.cn/boss`

Nginx 宸茬粡鎸夊瓙璺緞鏂瑰紡琛ュソ `/boss/` 鍙嶄唬銆?
娉ㄦ剰鐐癸細

- `proxy_buffering off` 宸叉墦寮€锛岄伩鍏?Open WebUI 娴佸紡杈撳嚭琚?Nginx 閲嶆柊鍒嗗潡
- `X-Forwarded-Prefix /boss` 宸蹭紶閫?- Open WebUI 浣跨敤瀛愯矾寰勬椂锛岃鎶?`WEBUI_URL` 璁剧疆鎴?`https://xueyin.net.cn/boss`

鏇存柊 Nginx 鍚庨噸杞斤細

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 4. 棣栨鐧诲綍鍚庣殑妫€鏌?
鐧诲綍 `https://xueyin.net.cn/boss/` 鍚庯紝杩涘叆锛?
`Admin Settings -> Connections -> OpenAI`

鏍稿杩炴帴鏄惁涓猴細

- URL: `http://host.docker.internal:8642/v1`
- API Key: 浣犻厤缃殑 `API_SERVER_KEY`

濡傛灉瀹瑰櫒绗竴娆″惎鍔ㄦ椂鐜鍙橀噺宸茬粡鍐欏锛岃繖涓€姝ラ€氬父浼氳嚜鍔ㄥ甫涓婏紱濡傛灉鍚庣画鏀硅繃鐜鍙橀噺锛孫pen WebUI 鍙兘浠嶇劧浠ユ暟鎹簱涓殑鏃ч厤缃负鍑嗐€?
涔熷彲浠ョ洿鎺ヨ窇浠撳簱鍐呯疆妫€鏌ワ細

```bash
cd backend
npm run deploy:boss:check
```

## 5. 杩欏鏂规涓轰粈涔堥€傚悎鐜板湪

- 鍓嶇涓嶇敤鑷爺锛宍/boss` 鐩存帴灏辨槸鎴愮啛鑱婂ぉ澹?- Hermes 鏈韩灏辨槸 agent锛屾妧鑳姐€佺粓绔€佹枃浠舵搷浣溿€佹悳绱㈤兘鍦ㄥ悓涓€璺噷
- Open WebUI 鍘熺敓灏辨槸 OpenAI 鍗忚鍏ュ彛锛孒ermes 涔熸毚闇?OpenAI 鍏煎鎺ュ彛锛屾帴娉曟渶椤?- 鍗佷汉浠ュ唴娌″繀瑕佸厛涓婃洿閲嶇殑涓棿灞?
## Windows / Docker Desktop 鍏滃簳璺緞

濡傛灉鐩爣鏈烘病鏈夊彲鐢ㄧ殑 WSL Linux 鍙戣鐗堬紝鎴栬€呭晢搴楀畨瑁?WSL 鍒嗗彂鐗堝け璐ワ紝鍙互鐩存帴璧?Docker Desktop 鐗?Hermes锛?
```powershell
cd backend
npm run deploy:boss:prepare:windows
cd deploy
New-Item -ItemType Directory -Force .docker-public | Out-Null
'{}' | Set-Content .docker-public/config.json
$env:DOCKER_CONFIG = (Resolve-Path .docker-public).Path
docker compose -f docker-compose.openwebui-hermes-docker.yml up -d --build
```

杩欐潯璺緞鐨勭壒鐐癸細

- Hermes Gateway 杩愯鍦ㄨ嚜寤?Linux 瀹瑰櫒閲岋紝涓嶄緷璧栦富鏈哄厛瑁?Ubuntu/WSL 鐢ㄦ埛鎬?- Hermes 鐩存帴鎸傝浇浠撳簱鐩綍锛宼erminal 鍜?file ops 浠嶇劧鑳芥搷浣滈」鐩枃浠?- Open WebUI 閫氳繃瀹瑰櫒鍐呯綉鐩磋繛 `hermes-gateway:8642`
- 鐢ㄧ嫭绔?`DOCKER_CONFIG` 瑙勯伩 Windows Docker Desktop 鍑嵁鍔╂墜寮傚父
- 褰撳墠浠撳簱浼氬湪 `hermes-gateway` 瀹瑰櫒鍚姩鏃舵妸 `HERMES_LLM_BASE_URL` 鍜?`HERMES_LLM_MODEL` 鍐欏叆 `~/.hermes/config.yaml`
  Hermes 0.9 宸蹭笉鍐嶆妸 `OPENAI_BASE_URL` 鎴?`LLM_MODEL` 褰撲綔涓婚厤缃潵婧愶紝鍙厤杩欎袱涓棫鐜鍙橀噺浼氳杩愯鏃堕敊璇洖閫€鍒?OpenRouter

濡傛灉 Open WebUI 闀滃儚鍦ㄧ洰鏍囨満涓婃寔缁媺鍙栧け璐ワ紝鍙互淇濈暀 Hermes Gateway 瀹瑰櫒鍖栵紝Open WebUI 鏀硅蛋 Windows 鍘熺敓 Python 杩涚▼锛?
```powershell
cd backend
npm run deploy:boss:prepare:windows
cd deploy
New-Item -ItemType Directory -Force .docker-public | Out-Null
'{}' | Set-Content .docker-public/config.json
$env:DOCKER_CONFIG = (Resolve-Path .docker-public).Path
docker compose --env-file .env.openwebui-hermes-docker -f docker-compose.openwebui-hermes-docker.yml up -d --build hermes-gateway
powershell -ExecutionPolicy Bypass -File .\start-openwebui-hermes-windows.ps1
```

杩欐潯 fallback 鐨勭壒鐐癸細

- Hermes 缁х画淇濈暀 Docker 闅旂锛宎gent terminal/file ops 璇箟涓嶅彉
- Open WebUI 鍒╃敤涓绘満鐜版垚 Python 鐩存帴鍚姩锛岄伩寮€ 300MB 鍒?1GB 绾ч暅鍍忓眰鍙嶅 EOF
- Open WebUI 浠嶇劧閫氳繃 `http://127.0.0.1:8642/v1` 瀵规帴 Hermes 鐨?OpenAI 鍏煎鎺ュ彛
- RAG embedding 寤鸿鐩存帴璧板閮?OpenAI 鍏煎妯″瀷锛岄伩鍏嶉娆″惎鍔ㄥ幓 Hugging Face 鎷夋湰鍦?embedding 妯″瀷
- 濡傛灉鍙槸鎶?Open WebUI 褰?Hermes 鐨勫墠绔３锛屽缓璁妸 `ENABLE_PIP_INSTALL_FRONTMATTER_REQUIREMENTS=false`锛岄伩鍏嶉鍚崱鍦?functions/tools 渚濊禆瀹夎
- 褰撳墠浠撳簱閲岀殑 Windows fallback 浼氳嚜鍔ㄦ妸 pip 鍖呭唴鐨勫墠绔潤鎬佹枃浠跺鍒跺埌 `Lib/build`锛屽苟閫氳繃 `uvicorn --lifespan off` 鍚姩 `openwebui_windows_app.py`

## 杩愮淮鎻愰啋

- `WEBUI_URL` 灞炰簬鎸佷箙鍖栭厤缃紝鏈€濂介娆″惎鍔ㄥ墠灏卞啓瀵?- 濡傛灉 `/boss` 涓嬪嚭鐜伴潤鎬佽祫婧?404 鎴栫櫥褰曞紓甯革紝浼樺厛妫€鏌?`WEBUI_URL` 鏄惁杩樻槸鏍硅矾寰?- 濡傛灉鐩爣鏈哄湪鍥藉唴缃戠粶鐜锛屼紭鍏堢粰 `.env.openwebui-hermes-docker` 澧炲姞 `RAG_EMBEDDING_ENGINE=openai`銆乣RAG_OPENAI_API_BASE_URL`銆乣RAG_OPENAI_API_KEY`銆乣RAG_EMBEDDING_MODEL`锛屾妸 RAG embedding 鐩存帴鎸囧悜鐜版垚鐨?OpenAI 鍏煎鎻愪緵鏂?- 濡傛灉 Open WebUI 闀挎椂闂村仠鍦?`Installing external dependencies of functions and tools...`锛屼紭鍏堢‘璁?`ENABLE_PIP_INSTALL_FRONTMATTER_REQUIREMENTS=false`
- 濡傛灉 Hermes 鏃ュ織閲屽嚭鐜?`Provider: openrouter` 浣嗕綘鏄庢槑鎺ョ殑鏄嚜瀹氫箟 OpenAI 鍏煎绔偣锛屼紭鍏堟鏌ュ鍣ㄥ唴 `~/.hermes/config.yaml`
  `model.provider` 搴斾负 `custom`锛屽苟涓?`model.base_url` 搴旀寚鍚戜綘鐨勭湡瀹炰笂娓稿湴鍧€
- 濡傛灉妯″瀷涓嬫媺涓虹┖锛屼紭鍏堟鏌?Hermes 绔槸鍚﹀瓨娲伙細

```bash
curl http://127.0.0.1:8642/health
curl http://127.0.0.1:8642/v1/models
```

- 濡傛灉閲嶆柊鐢熸垚浜嗗瘑閽ワ紝璁板緱淇濊瘉 `backend/deploy/.env.openwebui-hermes` 閲岀殑 `OPENAI_API_KEY` 涓?`~/.hermes/.env` 閲岀殑 `API_SERVER_KEY` 瀹屽叏涓€鑷?
## 瀹樻柟渚濇嵁

- Open WebUI 瀹樼綉锛?  https://www.openwebui.com/
- Hermes Agent 鎺?Open WebUI锛?  https://docs.openwebui.com/getting-started/quick-start/connect-an-agent/hermes-agent/
- Open WebUI 杩炴帴 OpenAI 鍗忚鎻愪緵鏂癸細
  https://docs.openwebui.com/getting-started/quick-start/connect-a-provider/starting-with-openai/
- Open WebUI 鐜鍙橀噺 `WEBUI_URL`锛?  https://docs.openwebui.com/reference/env-configuration/
- Open WebUI 鍙嶄唬涓庢祦寮?WS 鎺掗殰锛?  https://docs.openwebui.com/troubleshooting/connection-error/
