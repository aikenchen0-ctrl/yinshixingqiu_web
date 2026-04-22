const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
const websiteRoot = __dirname;

const mimeTypeMap = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function normalizePathname(pathname) {
  try {
    return decodeURIComponent(pathname || "/");
  } catch (error) {
    return null;
  }
}

function resolveFilePath(pathname) {
  if (pathname === "/") {
    return path.join(websiteRoot, "index.html");
  }

  const targetPath = path.resolve(websiteRoot, `.${pathname}`);
  if (targetPath !== websiteRoot && !targetPath.startsWith(`${websiteRoot}${path.sep}`)) {
    return null;
  }

  return targetPath;
}

function sendResponse(res, statusCode, headers, body) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

function sendFile(req, res, filePath, pathname) {
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendResponse(
      res,
      404,
      {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
      "Not Found"
    );
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const cacheControl = pathname.startsWith("/assets/")
    ? "public, max-age=2592000, immutable"
    : "no-cache";

  const headers = {
    "Content-Type": mimeTypeMap[extension] || "application/octet-stream",
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
  };

  if (req.method === "HEAD") {
    sendResponse(res, 200, headers);
    return;
  }

  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const pathname = normalizePathname(new URL(req.url || "/", `http://${req.headers.host}`).pathname);
  console.log(`[official-website] ${req.method} ${pathname || "/invalid"}`);

  if (!pathname) {
    sendResponse(
      res,
      400,
      {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
      "Bad Request"
    );
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendResponse(
      res,
      405,
      {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
      "Method Not Allowed"
    );
    return;
  }

  const filePath = resolveFilePath(pathname);
  if (!filePath) {
    sendResponse(
      res,
      403,
      {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
      "Forbidden"
    );
    return;
  }

  sendFile(req, res, filePath, pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`official-website listening on http://${HOST}:${PORT}`);
});
