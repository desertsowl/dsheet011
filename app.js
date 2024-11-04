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
    res.render('index', { user: req.session.user || null, error: null });
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
    let error = null;

    if (users.find(user => user.username === username)) {
        error = 'ユーザーは既に存在します';
    } else {
        const hashedPassword = await bcrypt.hash(password, 10);
        users.push({ username, password: hashedPassword });
        writeUsers(users);
    }

    res.render('index', { user: req.session.user || null, error });
});

// ログイン
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const users = readUsers();
    const user = users.find(user => user.username === username);
    let error = null;

    if (!user) {
        error = 'ユーザーが見つかりません';
    } else {
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            error = 'パスワードが間違っています';
        } else {
            req.session.user = { username: user.username };
        }
    }

    if (error) {
        return res.render('index', { user: null, error });
    }

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
