# VerifySys 自动部署说明

本文档对应的部署链路：

1. 本地推送代码到 `main`
2. GitHub Actions 构建前端、后端 Docker 镜像并推送到 GHCR
3. GitHub Actions 调用 Jenkins webhook
4. Jenkins 在服务器 `/opt/verifysys` 执行 `docker compose pull` 和 `docker compose up -d --remove-orphans`
5. 1Panel 反向代理域名到前端端口

## 当前项目结构判断

- 前端目录：`front`
- 前端技术栈：Vite + Vue 3 + TypeScript
- 前端构建命令：`npm run build`
- 前端容器端口：`80`
- 前端运行方式：Nginx 托管 `dist`，并把 `/api`、`/uploads` 反向代理到后端容器 `api:3000`
- 后端目录：`nodeServer`
- 后端技术栈：Express + TypeScript
- 后端构建命令：`npm run build`
- 后端运行命令：`npm start`
- 后端监听端口：`PORT`，Compose 固定传入 `3000`
- 后端 API 前缀：`/api`
- 数据库：线上已有 MySQL，Compose 不创建 MySQL 容器

## 服务器目录

在服务器创建部署目录：

```bash
mkdir -p /opt/verifysys
cd /opt/verifysys
```

把仓库中的这两个文件放到服务器目录：

```text
/opt/verifysys/docker-compose.yml
/opt/verifysys/.env
```

`.env` 从 `.env.example` 复制后修改，不要把真实 `.env` 提交到 Git：

```bash
cp .env.example .env
```

关键配置：

```env
GHCR_IMAGE_PREFIX=ghcr.io/zzzeg/codeverifysys
IMAGE_TAG=latest
WEB_PORT=8080

DB_HOST=host.docker.internal
DB_PORT=3306
DB_NAME=数据库名
DB_USER=数据库用户
DB_PASSWORD=数据库密码

JWT_SECRET=生产环境长随机字符串
```

如果 MySQL 不在同一台服务器宿主机上，把 `DB_HOST` 改成后端容器可访问的 MySQL 地址。

如果服务器拉取私有 GHCR 镜像，需要先登录：

```bash
echo '<github_pat>' | docker login ghcr.io -u '<github_user>' --password-stdin
```

GitHub PAT 至少需要 `read:packages` 权限。

## Jenkins Job

Jenkins 不拉源码，只进入服务器部署目录执行 Compose 命令。

推荐 Jenkins Job 使用 Freestyle 或 Pipeline 均可，构建脚本保持简单：

```bash
set -e

cd /opt/verifysys
docker compose pull
docker compose up -d --remove-orphans
docker compose ps
```

如果 Jenkins 运行用户没有 Docker 权限，需要把 Jenkins 用户加入 `docker` 组，或在脚本中按服务器规范使用具备 Docker 权限的执行方式。

## GitHub Actions Secrets

仓库需要配置以下 Secrets：

```text
JENKINS_WEBHOOK_URL
JENKINS_WEBHOOK_TOKEN
```

- `JENKINS_WEBHOOK_URL`：Jenkins Job 的 webhook 地址，例如 Jenkins Generic Webhook Trigger、Build Token Root 或自定义反代后的触发地址。
- `JENKINS_WEBHOOK_TOKEN`：webhook 鉴权 token。如果 Jenkins webhook 不需要 Bearer token，可留空或删除该 Secret。

GHCR 推送使用 GitHub Actions 默认的 `GITHUB_TOKEN`，工作流已声明：

```yaml
permissions:
  contents: read
  packages: write
```

## 1Panel 反向代理

1Panel 网站反向代理目标填写服务器本机前端端口：

```text
http://127.0.0.1:${WEB_PORT}
```

例如 `.env` 中配置：

```env
WEB_PORT=8080
```

则 1Panel 反向代理目标为：

```text
http://127.0.0.1:8080
```

前端 Nginx 容器会把浏览器请求的 `/api/*` 和 `/uploads/*` 转发到后端容器，不需要在 1Panel 里单独配置 API 端口。

## 手动验证

首次部署或排障时，可以在服务器执行：

```bash
cd /opt/verifysys
docker compose pull
docker compose up -d --remove-orphans
docker compose logs -f --tail=100
```

访问：

```text
http://服务器IP:${WEB_PORT}
```

确认无误后，再通过 1Panel 绑定的域名访问。
