import express from 'express';

const app = express();
app.use(express.json());

const SECRET = process.env.BRIDGE_SECRET || 'zz0602';
const PORT = process.env.PORT || 3000;

let pendingCmd = null;
let lastSeen = null;

function auth(req) {
 const s = req.query.secret || req.headers['x-secret'];
 return s === SECRET;
}

// 手动控制接口
app.post('/toy-next', (req, res) => {
 if (!auth(req)) return res.status(403).json({ error: 'forbidden' });
 const { speed, pattern, level, stop, sec } = req.body || {};
 if (stop) {
 pendingCmd = { stop: true };
 } else if (pattern !== undefined) {
 pendingCmd = { pattern, level: level || 0.6 };
 } else if (speed !== undefined) {
 pendingCmd = { speed, sec };
 }
 res.json({ ok: true });
});

// toy.html轮询
app.get('/toy-poll', (req, res) => {
 lastSeen = Date.now();
 if (pendingCmd) {
 const cmd = pendingCmd;
 pendingCmd = null;
 return res.json({ cmd });
 }
 res.json({});
});

// 状态查询
app.get('/toy-status', (req, res) => {
 if (!auth(req)) return res.status(403).json({ error: 'forbidden' });
 const online = lastSeen && (Date.now() - lastSeen < 5000);
 res.json({ online: !!online, lastSeen });
});

// MCP接口
app.post('/mcp', (req, res) => {
 const body = req.body || {};
 const { method, id } = body;

 if (method === 'initialize') {
 return res.json({
 jsonrpc: '2.0', id,
 result: {
 protocolVersion: '2024-11-05',
 capabilities: { tools: {} },
 serverInfo: { name: 'toy控制', version: '1.0.0' }
 }
 });
 }

 if (method === 'tools/list') {
 return res.json({
 jsonrpc: '2.0', id,
 result: {
 tools: [
 {
 name: 'toy_set_speed',
 description: '设置toy强度，speed为0-1之间的小数，1=最强，0=停止。可选sec参数指定持续秒数后自动停止。',
 inputSchema: {
 type: 'object',
 properties: {
 speed: { type: 'number', description: '强度0-1' },
 sec: { type: 'number', description: '持续秒数，可选' }
 },
 required: ['speed']
 }
 },
 {
 name: 'toy_set_pattern',
 description: '设置toy振动花样，pattern为1-8，level为0-1之间的强度。',
 inputSchema: {
 type: 'object',
 properties: {
 pattern: { type: 'number', description: '花样1-8' },
 level: { type: 'number', description: '强度0-1' }
 },
 required: ['pattern']
 }
 },
 {
 name: 'toy_stop',
 description: '立即停止toy',
 inputSchema: { type: 'object', properties: {} }
 },
 {
 name: 'toy_status',
 description: '查询toy中继是否在线',
 inputSchema: { type: 'object', properties: {} }
 }
 ]
 }
 });
 }

 if (method === 'tools/call') {
 const toolName = body.params?.name;
 const toolArgs = body.params?.arguments || {};

 if (toolName === 'toy_set_speed') {
 pendingCmd = { speed: toolArgs.speed, sec: toolArgs.sec };
 return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `已设置强度${Math.round(toolArgs.speed * 100)}%` }] } });
 }

 if (toolName === 'toy_set_pattern') {
 pendingCmd = { pattern: toolArgs.pattern, level: toolArgs.level || 0.6 };
 return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `已设置花样${toolArgs.pattern}` }] } });
 }

 if (toolName === 'toy_stop') {
 pendingCmd = { stop: true };
 return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: '已发送停止指令' }] } });
 }

 if (toolName === 'toy_status') {
 const online = lastSeen && (Date.now() - lastSeen < 5000);
 return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: online ? '✅ 中继在线，toy已连接' : '❌ 中继不在线或toy未连接' }] } });
 }
 }

 return res.json({ jsonrpc: '2.0', id, result: {} });
});

app.get('/', (req, res) => res.send('bridge ok'));

app.listen(PORT, () => console.log('bridge listening on', PORT));
