const express = require('express');
const path = require('path');
const session = require('express-session');
const fs = require('fs');
const app = express();

// ✅ Render 部署时必须使用 /tmp 目录才能永久保存
// （只有 /tmp 在 Render 中是可写的）
const DATA_FILE = process.env.RENDER === 'true' 
  ? '/tmp/data.json' 
  : path.join(__dirname, 'data.json');

const PORT = process.env.PORT || 3000;

// 会话配置
app.use(session({
  secret: 'season-admin-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================
// 数据存储（自动适配 Render/本地环境）
// ==========================
let users = {};
let orders = [];

// 读取数据
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      users = data.users || {};
      orders = data.orders || [];
    }
  } catch (e) {
    console.error('读取数据失败:', e);
    users = {};
    orders = [];
  }
}

// 保存数据
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users, orders }, null, 2));
  } catch (e) {
    console.error('保存数据失败:', e);
  }
}

loadData();

// ==========================
// 页面路由
// ==========================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/list', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'list.html'));
});
app.get('/list.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'list.html'));
});
app.get('/detail', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'detail.html'));
});
app.get('/detail.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'detail.html'));
});
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/pay.html', (req, res) => {
  if (!req.session.user) return res.redirect('/login.html');
  res.sendFile(path.join(__dirname, 'public', 'pay.html'));
});
app.get('/profile.html', (req, res) => {
  if (!req.session.user) return res.redirect('/login.html');
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});
app.get('/recharge.html', (req, res) => {
  if (!req.session.user) return res.redirect('/login.html');
  res.sendFile(path.join(__dirname, 'public', 'recharge.html'));
});
app.get('/service', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'service.html'));
});
app.get('/price', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'price.html'));
});

// ==========================
// 登录状态检查
// ==========================
app.get('/api/checkLogin', (req, res) => {
  res.json({ isLogin: !!req.session.user });
});

// ==========================
// 退出登录
// ==========================
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.json({ ok: 0, msg: "退出失败" });
    }
    res.json({ ok: 1, msg: "退出成功" });
  });
});

// ==========================
// 用户注册
// ==========================
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || username.trim() === '' || password.trim() === '') {
    return res.json({ ok: 0, msg: "账号密码不能为空" });
  }
  if (users[username.trim()]) {
    return res.json({ ok: 0, msg: "账号已存在" });
  }
  const cleanUsername = username.trim();
  users[cleanUsername] = { password: password.trim(), balance: 0 };
  saveData();
  res.json({ ok: 1, msg: "注册成功" });
});

// ==========================
// 用户登录
// ==========================
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const cleanUsername = username ? username.trim() : '';
  const cleanPassword = password ? password.trim() : '';
  
  if (!users[cleanUsername]) {
    return res.json({ ok: 0, msg: "账号不存在" });
  }
  if (users[cleanUsername].password !== cleanPassword) {
    return res.json({ ok: 0, msg: "密码错误" });
  }
  req.session.user = cleanUsername;
  res.json({ ok: 1, msg: "登录成功" });
});

// ==========================
// 获取用户信息
// ==========================
app.get('/api/user', (req, res) => {
  const user = req.session.user;
  if (!user) return res.json({});
  res.json({ 
    username: user, 
    balance: Number(users[user].balance) || 0 
  });
});

// ==========================
// 充值
// ==========================
app.post('/recharge', (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect('/login.html');
  const coin = parseInt(req.body.coin) || 0;
  if (coin <= 0) {
    return res.redirect('/recharge.html');
  }
  users[user].balance = (Number(users[user].balance) || 0) + coin;
  saveData();
  res.redirect('/profile.html');
});

app.post('/api/recharge', (req, res) => {
  const user = req.session.user;
  if (!user) return res.json({ ok: 0, msg: "请先登录" });
  
  const coin = parseInt(req.body.coin) || 0;
  if (coin <= 0) return res.json({ ok: 0, msg: "金额必须大于0" });
  
  users[user].balance = (Number(users[user].balance) || 0) + coin;
  saveData();
  res.json({ ok: 1, balance: Number(users[user].balance) });
});

// ==========================
// 下单（保持你要求的 1:10 比例）
// ==========================
app.post('/order', (req, res) => {
  const user = req.session.user;
  if (!user) return res.json({ ok: 0, msg: "请先登录" });

  const { player, total, gift } = req.body;
  
  if (!player || !total) {
    return res.json({ ok: 0, msg: "缺少必要参数" });
  }
  
  const realTotal = parseFloat(total);
  const needCoin = Math.round(realTotal * 10); // 1元 = 10 Season币
  
  if (isNaN(needCoin) || needCoin <= 0) {
    return res.json({ ok: 0, msg: "金额计算错误" });
  }

  const userBalance = Number(users[user].balance) || 0;
  if (userBalance < needCoin) {
    return res.json({ ok: 0, msg: `余额不足，需${needCoin}Season币，当前仅${userBalance}币` });
  }

  users[user].balance = userBalance - needCoin;
  
  orders.push({
    orderId: "ORDER" + Date.now(),
    username: user,
    player,
    coin: needCoin,
    time: new Date().toLocaleString()
  });
  
  saveData();
  res.json({ ok: 1, msg: "下单成功" });
});

// ==========================
// 我的订单
// ==========================
app.get('/api/orders', (req, res) => {
  const user = req.session.user;
  if (!user) return res.json([]);
  res.json(orders.filter(o => o.username === user));
});

// ==============================================
// 管理员后台
// ==============================================
const ADMIN_PASSWORD = "admin123";

app.get('/admin', (req, res) => {
  if (req.session.admin !== true) {
    return res.send(`
      <h2>管理员登录</h2>
      <form method="POST" action="/admin/login">
        密码：<input type="password" name="pwd"><br>
        <button>登录</button>
      </form>
    `);
  }

  let userList = '';
  for (let u in users) {
    userList += `
    <tr>
      <td>${u}</td>
      <td>${users[u].password}</td>
      <td>${Number(users[u].balance) || 0}</td>
      <td>
        <form action="/admin/recharge" method="POST" style="display:inline">
          <input type="hidden" name="user" value="${u}">
          <input type="number" name="coin" placeholder="充值数量" required min="1">
          <button>充值</button>
        </form>
        <form action="/admin/delete" method="POST" style="display:inline" onsubmit="return confirm('确定删除？')">
          <input type="hidden" name="user" value="${u}">
          <button>删除</button>
        </form>
      </td>
    </tr>`;
  }

  let orderList = '';
  orders.forEach(o => {
    orderList += `
    <tr>
      <td>${o.orderId}</td>
      <td>${o.username}</td>
      <td>${o.player}</td>
      <td>${Number(o.coin) || 0}</td>
      <td>${o.time}</td>
    </tr>`;
  });

  res.send(`
    <h1>管理员后台</h1>
    <a href="/admin/logout">退出后台</a>
    <h3>总用户：${Object.keys(users).length}</h3>

    <h2>用户列表</h2>
    <table border="1" cellpadding="6">
      <tr><th>账号</th><th>密码</th><th>余额</th><th>操作</th></tr>
      ${userList}
    </table>

    <h2>订单记录</h2>
    <table border="1" cellpadding="6">
      <tr><th>订单号</th><th>用户</th><th>陪玩</th><th>消耗</th><th>时间</th></tr>
      ${orderList}
    </table>
  `);
});

app.post('/admin/login', (req, res) => {
  const pwd = req.body.pwd ? req.body.pwd.trim() : '';
  if (pwd === ADMIN_PASSWORD) {
    req.session.admin = true;
  }
  res.redirect('/admin');
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('退出管理员失败:', err);
    res.redirect('/admin');
  });
});

app.post('/admin/recharge', (req, res) => {
  if (req.session.admin !== true) return res.redirect('/admin');
  const { user, coin } = req.body;
  const rechargeCoin = parseInt(coin) || 0;
  
  if (users[user] && rechargeCoin > 0) {
    users[user].balance = (Number(users[user].balance) || 0) + rechargeCoin;
    saveData();
  }
  res.redirect('/admin');
});

app.post('/admin/delete', (req, res) => {
  if (req.session.admin !== true) return res.redirect('/admin');
  const { user } = req.body;
  if (users[user]) {
    delete users[user];
    orders = orders.filter(o => o.username !== user);
    saveData();
  }
  res.redirect('/admin');
});

// 启动
app.listen(PORT, () => {
  console.log('✅ 网站启动：http://localhost:' + PORT);
  console.log('✅ 管理员后台：http://localhost:' + PORT + '/admin');
  console.log('✅ 管理员密码：admin123');
  console.log('✅ 数据文件路径：', DATA_FILE);
});