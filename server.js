const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const UPSTREAM = "https://timetable.sruniv.com";
let upstreamCookie = "";

function proxy(request, response) {
  const target = new URL(request.url, UPSTREAM);
  const chunks = [];

  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    const body = Buffer.concat(chunks);
    const headers = {
      Accept: "application/json, text/html",
      Cookie: upstreamCookie,
      "User-Agent": request.headers["user-agent"] || "Mozilla/5.0",
      Referer: `${UPSTREAM}/batchReport`,
      "X-CSRF-TOKEN": request.headers["x-csrf-token"] || "",
      "X-Requested-With": request.headers["x-requested-with"] || "",
    };
    if (body.length) {
      headers["Content-Type"] = request.headers["content-type"] || "application/x-www-form-urlencoded";
      headers["Content-Length"] = body.length;
    }

    const upstreamRequest = https.request(target, { method: request.method, headers }, (upstreamResponse) => {
      const cookies = upstreamResponse.headers["set-cookie"];
      if (cookies) {
        const cookieMap = new Map(upstreamCookie.split("; ").filter(Boolean).map((cookie) => cookie.split("=", 1)));
        cookies.forEach((cookie) => { const [name, value] = cookie.split(";", 1)[0].split("="); cookieMap.set(name, `${name}=${value}`); });
        upstreamCookie = [...cookieMap.values()].join("; ");
      }
      response.writeHead(upstreamResponse.statusCode || 502, {
        "Content-Type": upstreamResponse.headers["content-type"] || "application/json",
      });
      upstreamResponse.pipe(response);
    });

    upstreamRequest.on("error", (error) => {
      response.writeHead(502, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: `Upstream request failed: ${error.message}` }));
    });
    upstreamRequest.end(body);
  });
}

function serveStatic(request, response) {
  const requestedPath = new URL(request.url, "http://localhost").pathname;
  const fileName = requestedPath === "/" ? "index.html" : requestedPath.slice(1);
  const filePath = path.join(__dirname, fileName);
  if (!filePath.startsWith(__dirname) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
  response.writeHead(200, {
    "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(filePath).pipe(response);
}

function classroomData(response) {
  https.get("https://empty-class-rooms.vercel.app/", (upstreamResponse) => {
    const chunks = [];
    upstreamResponse.on("data", (chunk) => chunks.push(chunk));
    upstreamResponse.on("end", () => {
      const html = Buffer.concat(chunks).toString("utf8");
      const match = html.match(/const OCCUPANCY=(\{[\s\S]*?\});\s*const DAYS/);
      if (!match) { response.writeHead(502, { "Content-Type": "application/json" }); response.end(JSON.stringify({ error: "Classroom data was not found" })); return; }
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(match[1]);
    });
  }).on("error", (error) => { response.writeHead(502, { "Content-Type": "application/json" }); response.end(JSON.stringify({ error: error.message })); });
}

http.createServer((request, response) => {
  if (request.url === "/classroom-data") { classroomData(response); return; }
  if (request.url.startsWith("/get-yearbpublic") || request.url.startsWith("/get-batchbpublic") || request.url.startsWith("/batchReport") || request.url.startsWith("/searchBatchReport2Public")) {
    proxy(request, response);
    return;
  }
  serveStatic(request, response);
}).listen(PORT, () => console.log(`Timetable Comparator running at http://localhost:${PORT}`));