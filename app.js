const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;

const usersFilePath = './users.json'; // ユーザーデータを保存するファイル

// ユーザーデータの読み書きヘルパー関数
function readUsers() {
    if (fs.existsSync(usersFilePath)) {
        const data = fs.readFileSync(usersFilePath);
        return JSON.parse(data);
    }
    return [];
}

function writeUsers(users) {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
}

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// ユーザー認証用のミドルウェア
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/');
}

// Routes
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user || null });
});

app.get('/checklist', isAuthenticated, (req, res) => {
    const results = [];
    fs.createReadStream('equipment.csv')
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
            res.render('checklist', { items: results });
        });
});

// ユーザー登録
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const users = readUsers();

    if (users.find(user => user.username === username)) {
        return res.status(400).send('ユーザーは既に存在します');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    users.push({ username, password: hashedPassword });
    writeUsers(users);

    res.redirect('/');
});

// ログイン
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const users = readUsers();
    const user = users.find(user => user.username === username);

    if (!user) {
        return res.status(400).send('ユーザーが見つかりません');
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        return res.status(400).send('パスワードが間違っています');
    }

    req.session.user = { username: user.username };
    res.redirect('/');
});

// ログアウト
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('ログアウトに失敗しました');
        }
        res.redirect('/');
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
