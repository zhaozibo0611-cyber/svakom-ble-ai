import express from 'express';

const app = express();
app.use(express.json());

const SECRET = process.env.BRIDGE_SECRET || 'zz0602';
const PORT = process.env.PORT || 3000;

let pendingCmd = null;
let lastSeen = null;

// 验证secret
function auth(req) {
 const s = req.query.secret || req.headers['x-secret'];
 return s === SECRET;
}

// MCP工具：AI调用来设置指令
app.post('/toy-next', (req, res) => {
 if (!auth(req)) return res.status(403).json({ error: 'forbidden' });
 const { speed, pattern level, stop, sec } = req.body || {};
 if (stop) {
 pendingCmd = { stop: true };
 } else if (pattern !== undefined) {
 pendingCmd = { pattern, level: level || 0.6 };
 } else if (speed !== undefined) {
 pendingCmd = { speed, sec };
 }
 res.json({ ok: true });
});

// 手机轮询：toy.html每300ms来取指令
app.get('/toy-poll', (req, res) => {
 lastSeen = Date.now();
 if (pendingCmd) {
 const cmd = pendingCmd;
 pendingCmd = null;
 return res.json({ cmd });
 }
 res.json({});
});

// MCP：查询中继是否在线
app.get('/toy-status', (req, res) => {
 if (!auth(req)) return res.status(403).json({ error: 'forbidden' });
 const online = lastSeen && (Date.now() - lastSeen < 5000);
 res.json({ online:!!online, lastSeen });
});

//健康检查
app.get('/', (req, res) => res.send('bridge ok'));

app.listen(PORT, () => console.log('bridge listening on', PORT));
