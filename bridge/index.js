import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

const SECRET = process.env.BRIDGE_SECRET || 'zz0602';
const VERCEL_URL = process.env.VERCEL_URL || 'https://phone-status-zeta.vercel.app';
const PORT = process.env.PORT || 3000;

function auth(req) {
 const s = req.query.secret || req.headers['x-secret'];
 return s === SECRET;
}

// MCP接口
app.post('/mcp', async (req, res) => {
 const body = req.body || {};
 const { method, id } = body;

 if (method === 'initialize') {
 return res.json({
 jsonrpc: '2.0', id,
 result: {
 protocolVersion: '2024-11-05',
 capabilities: { tools: {} },
 serverInfo: { name: 'toy控制', version: '2.0.0' }
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
 let cmd = null;
 let text = '';

 if (toolName === 'toy_set_speed') {
 cmd = { speed: toolArgs.speed, sec: toolArgs.sec };
 text = `已设置强度${Math.round(toolArgs.speed * 100)}%`;
 } else if (toolName === 'toy_set_pattern') {
 cmd = { pattern: toolArgs.pattern, level: toolArgs.level || 0.6 };
 text = `已设置花样${toolArgs.pattern}`;
 } else if (toolName === 'toy_stop') {
 cmd = { stop: true };
 text = '已发送停止指令';
 } else if (toolName === 'toy_status') {
 try {
 const r = await fetch(`${VERCEL_URL}/api/cmd`);
 text = '✅ 中继在线，toy已连接';
 } catch(e) {
 text = '❌ 中继不在线或toy未连接';
 }
 return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } });
 }

 if (cmd) {
 await fetch(`${VERCEL_URL}/api/cmd`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(cmd)
 });
 }

 return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } });
 }

 return res.json({ jsonrpc: '2.0', id, result: {} });
});

app.get('/', (req, res) => res.send('bridge ok'));

app.listen(PORT, () => console.log('bridge listening on', PORT));
