const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;

// MongoDB接続設定（データベース名: staff）
mongoose.connect('mongodb://localhost:27017/staff', { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
    console.log('MongoDB connected');
});

// スキーマとモデルの定義（コレクション名: everyone）
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    group: { type: Number, required: true },
    status: { type: Number, required: true },
    email: { type: String, required: true, unique: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
    unique: { type: Number, required: true }
}, { collection: 'everyone' });

userSchema.pre('save', function(next) {
    const now = Date.now();
    this.updated_at = now;
    if (!this.created_at) {
        this.created_at = now;
    }
    next();
});

const User = mongoose.model('User', userSchema);

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
    const { username, password, email } = req.body;
    let error = null;

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            error = 'ユーザーは既に存在します';
        } else {
            const hashedPassword = await bcrypt.hash(password, 10);
            const newUser = new User({
                username,
                password: hashedPassword,
                email,
                group: 2,  // デフォルトグループ: Worker
                status: 2, // デフォルト状態: Active
                unique: Date.now() // ユニーク値
            });
            await newUser.save();
            return res.redirect('/'); // 登録成功後ホームへリダイレクト
        }
    } catch (err) {
        error = `登録中にエラーが発生しました: ${err.message}`;
    }

    res.render('index', { user: req.session.user || null, error });
});

// ログイン
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    let error = null;

    try {
        const user = await User.findOne({ username });
        if (!user) {
            error = 'ユーザーが見つかりません';
        } else {
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                error = 'パスワードが間違っています';
            } else {
                req.session.user = { username: user.username };
                return res.redirect('/');
            }
        }
    } catch (err) {
        error = 'ログイン中にエラーが発生しました';
    }

    res.render('index', { user: null, error });
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

