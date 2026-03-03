"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelPortoneSchedules = exports.scheduleNext = void 0;
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const all_Store_1 = require("../all_Store");
// ---------------------- 설정 ----------------------
const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET; // imp_secret
// ---------------------- 미들웨어 본체 ----------------------
const scheduleNext = async (req, res, next) => {
    try {
        const subscriptionId = Number(res.locals.subscription.id);
        if (!subscriptionId) {
            res.status(400).json({ msg: "subscriptionId가 필요합니다." });
            return;
        }
        // 1) 구독 + 유저 조인 조회 (필수 컬럼만)
        const [rows] = await process._myApp.db.promise().query(`SELECT s.id as sub_id, s.user_id, s.price_cents, s.current_period_end, s.plan_name,
                u.portone_customer_id, u.billing_key_status, u.portone_billing_key
           FROM subscriptions s
           JOIN users u ON u.id = s.user_id
          WHERE s.id = ?
          LIMIT 1`, [subscriptionId]);
        const [sc_rows] = await process._myApp.db
            .promise()
            .query(`SELECT * FROM subscription_schedules WHERE subscription_id = ?`, [subscriptionId]);
        if (!rows.length) {
            res.status(404).json({ msg: "구독을 찾을 수 없습니다." });
            return;
        }
        const sub = rows[0];
        if (!sub.portone_customer_id || sub.billing_key_status !== "ACTIVE") {
            res.status(409).json({ msg: "빌링키가 활성 상태가 아닙니다." });
            return;
        }
        if (sub.price_cents === 0) {
            next();
            return;
        }
        const headers = {
            Authorization: `PortOne ${PORTONE_API_SECRET}`,
            "Content-Type": "application/json",
        };
        const BILLING_KEY = sub.portone_billing_key;
        // 2) next schedule_at 계산 및 merchant_uid 생성
        const TIME_TO_PAY = (0, all_Store_1.computeNextAt)(sub.current_period_end ? new Date(sub.current_period_end) : null);
        const PAYMENT_ID = encodeURIComponent(`order_${(0, uuid_1.v4)()}`);
        const url = `https://api.portone.io/payments/${PAYMENT_ID}/schedule`;
        const body = {
            payment: {
                billingKey: BILLING_KEY,
                orderName: `정기결제 ${sc_rows.length + 1}회차`,
                amount: {
                    total: sub.price_cents,
                },
                currency: "KRW",
            },
            timeToPay: TIME_TO_PAY,
        };
        const { data, status } = await axios_1.default.post(url, body, { headers });
        console.log("[OK]", status, data);
        // 5) DB에 스케줄 저장
        await process._myApp.db.promise().query(`INSERT INTO subscription_schedules (payment_id, subscription_id, schedule_at, amount_krw, status ,product_name)
         VALUES (?, ?, ?, ?, 'SCHEDULED',?)
         ON DUPLICATE KEY UPDATE schedule_at = VALUES(schedule_at), amount_krw = VALUES(amount_krw)`, [PAYMENT_ID, subscriptionId, (0, all_Store_1.formatDateTime)(TIME_TO_PAY), sub.price_cents, sub.plan_name]);
        next();
    }
    catch (err) {
        console.log("[scheduleNext] error:", err);
        next(err);
    }
};
exports.scheduleNext = scheduleNext;
/**결제 스케줄 삭제 */
async function cancelPortoneSchedules(req, res, next) {
    try {
        const subscriptionId = Number(res.locals.subscription?.id);
        const BILLING_KEY = res.locals?.user?.portone_billing_key;
        if (!subscriptionId)
            throw new Error("subscriptionId 필요");
        if (!BILLING_KEY)
            throw new Error("billingKey 필요");
        // DB 상태 취소로 마킹
        await process._myApp.db.promise().query(`UPDATE subscription_schedules
           SET status = 'CANCELLED',
           cancelled_at = NOW()
         WHERE subscription_id = ? AND status = 'SCHEDULED'`, [subscriptionId]);
        // PortOne 예약 일괄 취소
        const headers = {
            Authorization: `PortOne ${process.env.PORTONE_API_SECRET}`,
            "Content-Type": "application/json",
        };
        await axios_1.default.delete("https://api.portone.io/payment-schedules", {
            headers,
            data: { billingKey: BILLING_KEY },
        });
        next();
    }
    catch (err) {
        next(err);
    }
}
exports.cancelPortoneSchedules = cancelPortoneSchedules;
//# sourceMappingURL=scheduleMiddleware.js.map