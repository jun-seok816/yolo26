"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
const path_1 = __importDefault(require("path"));
const express_session_1 = __importDefault(require("express-session"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const imageRouter_1 = __importDefault(require("./router/imageRouter"));
// .env 파일에서 환경 변수 로드
dotenv_1.default.config();
//https://expressjs.com/ko/starter/static-files.html s
app.set("puplic", path_1.default.join(__dirname, "../build"));
app.use(express_1.default.static(app.settings.puplic));
app.use((0, cookie_parser_1.default)());
const sessionMiddleware = (0, express_session_1.default)({
    secret: "subscribe_loutbtbahah4281!@",
    resave: true,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000 * 7, // 24 hours
    },
});
app.use(sessionMiddleware);
app.use("/data", express_1.default.static(path_1.default.join(__dirname, "../../data")));
app.use("/images", imageRouter_1.default);
app.use("/assets", //  /assets/* 요청
express_1.default.static(path_1.default.join(__dirname, "../assets")));
// ② React 번들의 정적 파일
app.use(express_1.default.static(path_1.default.join(__dirname, "../build"), {
    index: false, // index.html 은 직접 라우트에서 전송
}));
app.use((err, req, res, next) => {
    // 이미 헤더가 전송됐다면 Express 기본 처리에 맡김
    if (res.headersSent) {
        return;
    }
    // 로그 남기기
    console.error(err);
    // 커스텀 에러에 statusCode 있으면 사용, 없으면 500
    const status = err.statusCode ?? 500;
    res.status(status).json({
        err: true,
        msg: "서버 오류가 발생했습니다.",
    });
});
// ⑤ React SPA 용 catch‑all
app.get("*", (_, res) => {
    res.sendFile(path_1.default.join(__dirname, "../build/index.html"));
});
console.log("[routes]", app._router.stack
    .filter((l) => l.route)
    .map((l) => `${Object.keys(l.route.methods)[0].toUpperCase()} ${l.route.path}`));
const server = app
    .listen(3005, () => {
    console.log(`Example app listening on port ${3005}`);
})
    .setTimeout(12000000);
server.keepAliveTimeout = 300; // Keep-Alive 연결 제한 시간
server.headersTimeout = 11000; // 헤더 대기 시간
exports.default = app;
//# sourceMappingURL=web.js.map