import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
function offline() {
  return {
    name: "offline-assets",
    closeBundle() {
      const files = [
        "/",
        "/index.html",
        "/vocabulary.json",
        "/candidates.json",
        "/expressions.json",
        "/data-report.json",
        "/icon.svg",
        "/manifest.webmanifest",
        ...readdirSync("dist/assets").map((f) => "/assets/" + f),
      ];
      const version = createHash("sha256")
        .update(
          files
            .filter((f) => f !== "/")
            .map((f) => readFileSync("dist" + f))
            .reduce((a, b) => Buffer.concat([a, b]), Buffer.alloc(0)),
        )
        .digest("hex")
        .slice(0, 12);
      writeFileSync(
        "dist/sw.js",
        `const CACHE='rc-lab-${version}';const FILES=${JSON.stringify(files)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('rc-lab-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()).then(()=>self.clients.matchAll()).then(cs=>cs.forEach(c=>c.postMessage('OFFLINE_READY')))));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.open(CACHE).then(async c=>(await c.match(e.request,{ignoreVary:true}))||fetch(e.request).catch(()=>e.request.mode==='navigate'?c.match('/index.html'):Response.error())))});`,
      );
    },
  };
}
export default defineConfig({
  plugins: [react(), offline()],
  test: { include: ["tests/**/*.test.ts"] },
});
