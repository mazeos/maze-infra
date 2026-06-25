// maze-deployer — recepcionista de deploys del VPS
// Escucha por HTTPS (vía Traefik). GitHub Actions le avisa con un token;
// valida y ejecuta el deploy localmente: git fetch + reset --hard + docker compose up.
// No expone SSH: el VPS hace todo el trabajo desde adentro.

const http = require("http");
const { execFile } = require("child_process");

const TOKEN = process.env.DEPLOY_TOKEN;
const PORT = 3000;

if (!TOKEN) {
  console.error("FATAL: falta DEPLOY_TOKEN");
  process.exit(1);
}

// Validaciones estrictas para evitar inyección de comandos.
function valida({ app_dir, branch, compose_file }) {
  if (!/^\/(docker|opt)\/[A-Za-z0-9_-]+$/.test(app_dir || "")) return "app_dir invalido";
  if (!/^[A-Za-z0-9_\/.-]+$/.test(branch || "")) return "branch invalido";
  if (compose_file && !/^[A-Za-z0-9_.-]+$/.test(compose_file)) return "compose_file invalido";
  return null;
}

function deploy({ app_dir, branch, compose_file, force_recreate }, cb) {
  const cf = compose_file || "docker-compose.yml";
  // force_recreate=false → no recrea contenedores sin cambios (ej: postgres de una app con DB)
  const fr = force_recreate === false ? "" : "--force-recreate";
  const script = [
    "set -e",
    'export GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new"',
    `cd ${app_dir}`,
    `git fetch origin ${branch}`,
    `git reset --hard origin/${branch}`,
    `docker compose -f ${cf} up -d --build ${fr}`,
  ].join("; ");
  execFile("bash", ["-lc", script], { timeout: 600000 }, (err, stdout, stderr) => {
    cb(err, (stdout || "") + (stderr || ""));
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200);
    return res.end("ok");
  }
  if (req.method !== "POST" || req.url !== "/deploy") {
    res.writeHead(404);
    return res.end("not found");
  }
  if ((req.headers["authorization"] || "") !== `Bearer ${TOKEN}`) {
    res.writeHead(401);
    return res.end("unauthorized");
  }
  let body = "";
  req.on("data", (c) => {
    body += c;
    if (body.length > 1e5) req.destroy();
  });
  req.on("end", () => {
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      res.writeHead(400);
      return res.end("bad json");
    }
    const bad = valida(data);
    if (bad) {
      res.writeHead(400);
      return res.end(bad);
    }
    deploy(data, (err, out) => {
      if (err) {
        console.error("[deploy] FAIL", data.app_dir, data.branch, err.message);
        res.writeHead(500);
        return res.end("deploy failed: " + err.message + "\n" + out);
      }
      console.log("[deploy] OK", data.app_dir, "@", data.branch);
      res.writeHead(200);
      res.end("deploy ok\n" + out);
    });
  });
});

server.listen(PORT, () => console.log("maze-deployer escuchando en :" + PORT));
