"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const subscriptionMiddleware_1 = require("../middleware/subscriptionMiddleware");
const express_1 = __importDefault(require("express"));
const scheduleMiddleware_1 = require("../middleware/scheduleMiddleware");
const billingKeyMiddleware_1 = require("../middleware/billingKeyMiddleware");
const router = express_1.default.Router();
router.post("/load", process._myApp.checkSession, subscriptionMiddleware_1.loadSubscription, (req, res) => {
    const lv_data = res.locals.subscription;
    const lv_subscription_schedules = res.locals.subscription_schedules;
    const lv_payments = res.locals.payments;
    res.send({
        sub: lv_data,
        schedules: lv_subscription_schedules,
        payments: lv_payments,
    });
});
router.post("/me", process._myApp.checkSession, async (req, res) => {
    try {
        const userId = Number(req.session.userId);
        const [rows] = await process._myApp.db
            .promise()
            .query(`SELECT *
               FROM users
              WHERE id = ?
              LIMIT 1`, [userId]);
        if (rows.length === 0) {
            res.status(404).json({ err: true, msg: "user not found" });
            return;
        }
        const { id, portone_billing_key, portone_customer_id, ...rest } = rows[0]; // id만 제거
        const lv_data = rest;
        res.json(lv_data);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ err: true, msg: "네트워크 오류" });
    }
});
router.post("/planChange", //플랜 변경 시 호출
process._myApp.checkSession, //로그인 세션 확인
subscriptionMiddleware_1.applyPlanChange, // 플랜 변경 로직
subscriptionMiddleware_1.loadSubscription, // 사용자 구독 정보 로드
billingKeyMiddleware_1.payNowAndRecord, // 결제 & 결제내역 저장
scheduleMiddleware_1.cancelPortoneSchedules, // 포트원 예약 삭제
scheduleMiddleware_1.scheduleNext, // 포트원 예약
(req, res) => {
    const lv_data = res.locals.subscription;
    res.send(lv_data);
});
router.post("/periodChange", //플랜 변경 시 호출
process._myApp.checkSession, //로그인 세션 확인
async (req, res, next) => {
    try {
        const changeDate = req.body.changeDateTime;
        await process._myApp.db.promise().query(`UPDATE subscriptions
        SET current_period_end = CONVERT_TZ(
          STR_TO_DATE(?, '%Y-%m-%dT%H:%i:%s.%fZ'),
          '+00:00', '+09:00'
        )
        WHERE user_id = ?;`, [changeDate, req.session.userId]);
        next();
    }
    catch (err) {
        next(err);
    }
}, subscriptionMiddleware_1.loadSubscription, // 사용자 구독 정보 로드
scheduleMiddleware_1.cancelPortoneSchedules, // 포트원 예약 삭제
scheduleMiddleware_1.scheduleNext, // 포트원 예약
(req, res) => {
    const lv_data = res.locals.subscription;
    res.send(lv_data);
});
// /**디버깅 용 */
// router.post(
//   "/nextPeriod",
//   process._myApp.checkSession,
//   rollToNextPeriod,
//   loadSubscription,
//   cancelPortoneSchedules,
//   scheduleNext,
//   (req, res) => {
//     const lv_data: SubscriptionRow = res.locals.subscription;
//     res.send(lv_data);
//   }
// );
exports.default = router;
//# sourceMappingURL=subscriptionRouter.js.map