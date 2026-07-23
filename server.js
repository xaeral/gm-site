const express = require("express");
const path = require("path");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const PORT = process.env.PORT || 4173;

const gDocPath = "/document/d/e/2PACX-1vQS4U5rszkiEDIlirKhNGFb8nbmhQSYmHJrbwPSNvkU9P5HHdXHrDJG_i95k_ey2kSCkzh2Fjlf00vP/pub?embedded=true";

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use(
  "/integrations/gdocs",
  createProxyMiddleware({
    target: "https://docs.google.com",
    changeOrigin: true,
    secure: true,
    pathRewrite: () => gDocPath,
    onProxyRes(proxyRes) {
      delete proxyRes.headers["x-frame-options"];
      delete proxyRes.headers["content-security-policy"];
      delete proxyRes.headers["content-security-policy-report-only"];
    }
  })
);

app.use(
  "/integrations/vrelations",
  createProxyMiddleware({
    target: "https://v-relations.com",
    changeOrigin: true,
    secure: true,
    pathRewrite: (pathValue) => pathValue.replace("/integrations/vrelations", ""),
    ws: true,
    onProxyRes(proxyRes) {
      delete proxyRes.headers["x-frame-options"];
      delete proxyRes.headers["content-security-policy"];
      delete proxyRes.headers["content-security-policy-report-only"];
    }
  })
);

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`GM Dashboard running at http://localhost:${PORT}`);
});
