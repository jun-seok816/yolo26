"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
/**
 * POST /loginEmailCheck
 * @body { email: string }
 * @returns { exists: boolean }
 */
router.post("/loginEmailCheck", async (req, res) => {
    try {
        const email = req.body?.email ?? req.body?.data?.email;
        if (!email) {
            res.status(400).json({ err: true, msg: "email is required" });
            return;
        }
        /* ① 존재 여부 확인 */
        const [rows] = await process._myApp.db
            .promise()
            .query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
        let userId;
        let created = false;
        if (rows.length === 0) {
            /* ② 미존재 → 즉시 삽입 */
            const [result] = await process._myApp.db
                .promise()
                .query("INSERT INTO users (email) VALUES (?)", [email]);
            userId = Number(result.insertId);
            created = true;
        }
        else {
            /* ③ 이미 존재 */
            userId = Number(rows[0].id);
        }
        /* ④ 세션 무조건 초기화 */
        req.session.regenerate((err) => {
            // regenerate 실패 대비
            if (err)
                console.error("Session regenerate error:", err);
        });
        req.session.userId = userId;
        req.session.email = email;
        /* ⑤ 응답 */
        res.json({ err: false, exists: !created, created });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ err: true });
    }
});
router.post("/logout", (req, res) => {
    // 세션 쿠키 이름(기본: connect.sid). 미들웨어에서 name을 바꿨다면 동일하게 맞추세요.
    const cookieName = process.env.SESSION_NAME || "connect.sid";
    const cookiePath = req.session?.cookie?.path || "/";
    if (!req.session) {
        res.clearCookie(cookieName, { path: cookiePath, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
        res.json({ err: false, loggedOut: true });
        return;
    }
    req.session.destroy((err) => {
        if (err) {
            console.error("Session destroy error:", err);
            return res.status(500).json({ err: true, msg: "session destroy failed" });
        }
        // 브라우저에서 세션 쿠키 삭제
        res.clearCookie(cookieName, {
            path: cookiePath,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
        });
        return res.json({ err: false, loggedOut: true });
    });
});
router.get("/loginSession", (req, res) => {
    console.log(`session Data user_id: %o`, req.session.userId);
    if (req.session.userId) {
        res.send({
            loggedIn: true,
            email: req.session.email,
        });
    }
    else {
        res.send({ loggedIn: false });
    }
});
/**
 * POST /save_data_google
 * @body { access_token: string; expires_in?: number }
 */
router.post("/save_data_google", async (req, res) => {
    try {
        const { access_token } = req.body.data;
        /* ① Google OAuth 토큰 확인 → email 획득 */
        let email;
        try {
            const { data } = await axios_1.default.get(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${access_token}`);
            email = data.email;
        }
        catch {
            res.status(400).json({ err: true, msg: "invalid token" });
            return;
        }
        /* ② users 테이블 조회 */
        const [rows] = await process._myApp.db
            .promise()
            .query("SELECT id FROM users WHERE email = ? LIMIT 1", [
            email,
        ]);
        if (rows.length === 0) {
            /* ─── 첫 방문: 회원가입 ─── */
            const [result] = await process._myApp.db
                .promise()
                .query("INSERT INTO users (email) VALUES (?)", [email]);
            // 세션 초기화
            req.session.userId = Number(result.insertId);
            req.session.email = email;
            res.json({ err: false, msg: "sign_up" });
            return;
        }
        /* ─── 이미 회원: 로그인 ─── */
        req.session.userId = rows[0].id;
        req.session.email = email;
        res.json({ err: false, msg: "login" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ err: true });
    }
});
/**
 * POST /sign_up
 * @body { email: string }
 */
router.post("/sign_up", async (req, res) => {
    try {
        const email = req.body?.email ?? req.body?.data?.email;
        if (!email) {
            res.status(400).json({ err: true, msg: "email is required" });
            return;
        }
        /* 중복 체크 */
        const [dup] = await process._myApp.db
            .promise()
            .query("SELECT 1 FROM users WHERE email = ? LIMIT 1", [
            email,
        ]);
        if (dup.length) {
            res.status(409).json({ err: true, msg: "email already exists" });
            return;
        }
        /* 회원 등록 */
        const [result] = await process._myApp.db
            .promise()
            .query("INSERT INTO users (email) VALUES (?)", [email]);
        req.session.userId = Number(result.insertId);
        req.session.email = email;
        res.json({ err: false, msg: "sign_up" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ err: true });
    }
});
exports.default = router;
//# sourceMappingURL=loginRouter.js.map