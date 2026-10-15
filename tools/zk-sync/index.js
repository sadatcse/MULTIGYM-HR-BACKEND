// ZKTeco LAN sync agent.
//
// For devices that cannot push to the cloud server directly (no ADMS / Cloud
// Server menu, or no internet at the branch). Run this on any always-on PC on
// the same network as the device(s): it reads new attendance logs over the
// ZK protocol (TCP 4370) and posts them to the HR backend.
//
//   cd Backend/tools/zk-sync && npm install
//   copy config.example.json config.json   (edit it)
//   node index.js            # one sync
//   node index.js --watch    # sync every `intervalMinutes`
//
// The device key comes from HR Workflow Settings → Device sync key. Each
// device's serial number must be approved in Attendance → Devices.

const fs = require('fs');
const path = require('path');
const ZKLib = require('node-zklib');

const cfgPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(cfgPath)) {
  console.error('config.json not found — copy config.example.json and edit it.');
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const statePath = path.join(__dirname, 'state.json');
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};

const pad = (n) => String(n).padStart(2, '0');
// Device clocks run on local (Dhaka) time; send the wall-clock string as-is.
const localString = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

async function syncDevice(device) {
  const zk = new ZKLib(device.ip, device.port || 4370, 10000, 4000);
  await zk.createSocket();
  try {
    const info = await zk.getInfo().catch(() => ({}));
    const serial = device.serialNumber || info.serialNumber || device.ip;
    const logs = await zk.getAttendances();
    const since = state[serial] || '1970-01-01 00:00:00';
    const punches = (logs.data || [])
      .map((l) => ({ deviceUserId: String(l.deviceUserId), time: localString(new Date(l.recordTime)) }))
      .filter((p) => p.time > since);
    if (!punches.length) {
      console.log(`[${serial}] no new punches`);
      return;
    }
    for (let i = 0; i < punches.length; i += 2000) {
      const chunk = punches.slice(i, i + 2000);
      const res = await fetch(`${cfg.server.replace(/\/$/, '')}/attendance/device-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-device-key': cfg.deviceKey },
        body: JSON.stringify({ serialNumber: serial, punches: chunk }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`push failed (${res.status}): ${body.message || ''}`);
      console.log(`[${serial}] pushed ${chunk.length} → stored ${body.stored}, unmatched ${body.unmatched}`);
    }
    state[serial] = punches.map((p) => p.time).sort().pop();
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  } finally {
    await zk.disconnect().catch(() => {});
  }
}

async function runOnce() {
  for (const d of cfg.devices) {
    try {
      await syncDevice(d);
    } catch (e) {
      console.error(`[${d.ip}] ${e.message || e}`);
    }
  }
}

(async () => {
  await runOnce();
  if (process.argv.includes('--watch')) {
    setInterval(runOnce, (cfg.intervalMinutes || 5) * 60 * 1000);
  }
})();
