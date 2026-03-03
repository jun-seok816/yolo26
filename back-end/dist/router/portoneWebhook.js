"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onPaymentSucceeded = exports.commitCycleAndGrantTokens = exports.onScheduleFailed = void 0;
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const server_sdk_1 = require("@portone/server-sdk");
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const crypto_1 = __importDefault(require("crypto"));
const all_Types_1 = require("../all_Types");
const all_Store_1 = require("../all_Store");
const router = express_1.default.Router();
/** ──────────────── 공통 유틸 ──────────────── **/
const redactObj = (obj) => {
    const clone = {};
    for (const k of Object.keys(obj || {})) {
        if (/authorization|cookie|token|secret|password/i.test(k)) {
            clone[k] = "[REDACTED]";
        }
        else {
            clone[k] = obj[k];
        }
    }
    return clone;
};
const hexHash = (s) => crypto_1.default.createHash("sha256").update(s, "utf8").digest("hex");
const nowISO = () => new Date().toISOString();
/** 요청 스코프 로깅 미들웨어 (요청ID/타이밍) */
router.use("/portone", (req, _res, next) => {
    req._rid = req.headers["x-request-id"] || (0, uuid_1.v4)();
    req._t0 = Date.now();
    const rid = req._rid;
    console.log(`[portone][${rid}] ⇢ incoming ${req.method} ${req.originalUrl} @ ${nowISO()}`);
    console.log(`[portone][${rid}] ⇢ ip=${req.ip} content-type=${req.headers["content-type"]} content-length=${req.headers["content-length"]}`);
    console.log(`[portone][${rid}] ⇢ headers=`, redactObj(req.headers));
    next();
});
// /** 이 경로만 원본 바디 문자열로 받기 (전역 json보다 "먼저" 적용돼야 함) */
// router.use("/portone", bodyParser.text({ type: "application/json" }));
router.post("/portone", body_parser_1.default.text({ type: "*/*" }), async (req, res) => {
    const rid = req._rid || "no-rid";
    const t0 = req._t0 || Date.now();
    try {
        // payload 확보(반드시 string)
        const isBuf = Buffer.isBuffer(req.body);
        const isStr = typeof req.body === "string";
        const payload = isBuf
            ? req.body.toString("utf8")
            : isStr
                ? req.body
                : "";
        console.log(`[portone][${rid}] body typeof=${typeof req.body} isBuffer=${isBuf} len=${isStr ? payload.length : (isBuf ? req.body.length : 0)} sha256=${isStr || isBuf ? hexHash(payload) : "NA"}`);
        if (!isStr && !isBuf) {
            console.warn(`[portone][${rid}] WARN: body가 string/buffer가 아님 → verify 실패 가능`);
        }
        console.log(`[portone][${rid}] verify start`);
        const evt = await server_sdk_1.Webhook.verify(process.env.PORTONE_WEBHOOK_SECRET, payload, req.headers);
        console.log(`[portone][${rid}] verify ok type=${String(evt.type)} keys=${Object.keys(evt || {}).join(",")}`);
        //미지원/알 수 없는 스키마면 무시
        if (server_sdk_1.Webhook.isUnrecognizedWebhook(evt)) {
            console.log(`[portone][${rid}] unrecognized event → 200`);
            return void res.sendStatus(200);
        }
        // 관심 이벤트만 처리
        if (evt.type === "Transaction.Paid" ||
            evt.type === "Transaction.Failed" ||
            evt.type === "Transaction.PayPending") {
            const { paymentId } = evt.data;
            console.log(`[portone][${rid}] event.type=${evt.type} paymentId=${paymentId}`);
            // 결제 단건 재조회
            console.log(`[portone][${rid}] getPayment start`);
            const payment = await (0, server_sdk_1.PaymentClient)({
                secret: process.env.PORTONE_API_SECRET,
            }).getPayment({ paymentId });
            console.log(`[portone][${rid}] getPayment ok status=${payment.status.toString()} amount=${payment?.amount?.total ?? "NA"} method=${payment?.method?.type ?? "NA"}`);
            const conn = await process._myApp.db.promise().getConnection();
            console.log(`[portone][${rid}] db connection acquired`);
            try {
                await conn.beginTransaction();
                console.log(`[portone][${rid}] tx begin`);
                if (payment.status === "PAID") {
                    await onPaymentSucceeded(conn, paymentId, {
                        portoneTxId: payment.id,
                        rid
                    });
                    console.log(`[portone][${rid}] commitCycleAndGrantTokens start`);
                    await commitCycleAndGrantTokens(conn, paymentId, rid);
                    console.log(`[portone][${rid}] commitCycleAndGrantTokens ok`);
                }
                else {
                    console.log(`[portone][${rid}] onScheduleFailed start (status=${payment.status.toString()})`);
                    await onScheduleFailed(conn, paymentId, rid);
                    console.log(`[portone][${rid}] onScheduleFailed ok`);
                }
                await conn.commit();
                console.log(`[portone][${rid}] tx commit`);
                const ms = Date.now() - t0;
                console.log(`[portone][${rid}] ✓ 200 (${ms}ms)`);
                return void res.sendStatus(200);
            }
            catch (e) {
                await conn.rollback();
                console.error(`[portone][${rid}] tx rollback due to error:`, e?.message);
                console.error(e?.stack || e);
                if (axios_1.default.isAxiosError(e)) {
                    console.error(`[portone][${rid}] axios error status=`, e.response?.status);
                    console.error(`[portone][${rid}] axios error data=`, e.response?.data);
                }
                else {
                    console.error(`[portone][${rid}] unknown error`, e);
                }
                return void res.sendStatus(500);
            }
            finally {
                conn.release();
                console.log(`[portone][${rid}] db connection released`);
            }
        }
        console.log(`[portone][${rid}] ignored event type=${evt?.type}`);
        const ms = Date.now() - t0;
        console.log(`[portone][${rid}] ✓ 200 (${ms}ms)`);
        return void res.sendStatus(200);
    }
    catch (e) {
        if (e instanceof server_sdk_1.Webhook.WebhookVerificationError) {
            console.warn(`[portone][${rid}] verify error → 400:`, e.message);
            return void res.sendStatus(400);
        }
        console.error(`[portone][${rid}] 500 error:`, e?.message);
        console.error(e?.stack || e);
        return void res.sendStatus(500);
    }
});
/** 실패 플로우 */
async function onScheduleFailed(conn, paymentId, rid) {
    console.log(`[portone][${rid}] onScheduleFailed paymentId=${paymentId}`);
    const [sRows] = await conn.query(`SELECT subscription_id, amount_krw, product_name, status
       FROM subscription_schedules
      WHERE payment_id = ?
      FOR UPDATE`, [paymentId]);
    console.log(`[portone][${rid}] schedules rows=${sRows.length}`);
    if (sRows.length === 0) {
        console.warn(`[portone][${rid}] unknown paymentId → skip`);
        return;
    }
    const sch = sRows[0];
    const [subRows] = await conn.query(`SELECT id, user_id FROM subscriptions WHERE id = ?`, [sch.subscription_id]);
    console.log(`[portone][${rid}] subscription rows=${subRows.length}`);
    const { id: subscriptionId, user_id: userId } = subRows[0];
    if (sch.status === "SCHEDULED") {
        const [r] = await conn.query(`UPDATE subscription_schedules
          SET status='CANCELLED', cancelled_at=NOW()
        WHERE payment_id=? AND status='SCHEDULED'`, [paymentId]);
        console.log(`[portone][${rid}] schedules CANCELLED result=`, r);
    }
    const paidAt = (0, all_Store_1.formatDateTime)(new Date());
    const orderName = "정기결제(실패)";
    const [ins] = await conn.query(`INSERT INTO payments
       (user_id, subscription_id, payment_id, portone_tx_id, order_name,
        amount_krw, currency, is_success, paid_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'KRW', 0, ?, NOW())`, [userId, subscriptionId, paymentId, null, orderName, sch.amount_krw, paidAt]);
    console.log(`[portone][${rid}] payments INSERT result=`, ins);
}
exports.onScheduleFailed = onScheduleFailed;
/** 성공 플로우 */
async function commitCycleAndGrantTokens(conn, paymentId, rid) {
    console.log(`[portone][${rid}] commitCycle paymentId=${paymentId}`);
    const [subID] = await conn.query(`SELECT subscription_id FROM subscription_schedules WHERE payment_id = ?`, [paymentId]);
    console.log(`[portone][${rid}] schedule→sub rows=${subID.length}`);
    if (subID.length === 0)
        throw new Error("SUB_SCHEDULE_NOT_FOUND");
    const subscriptionId = Number(subID[0].subscription_id);
    const [rows] = await conn.query(`SELECT id, user_id, plan_name, billing_cycle, current_period_end,
            pending_plan_name, pending_billing_cycle, cancel_at_period_end
       FROM subscriptions
      WHERE id = ?
      FOR UPDATE`, [subscriptionId]);
    console.log(`[portone][${rid}] sub lock rows=${rows.length}`);
    if (rows.length === 0)
        throw new Error("SUB_NOT_FOUND");
    let sub = rows[0];
    const nextPlan = (sub.pending_plan_name ?? sub.plan_name);
    const nextCycle = (sub.pending_billing_cycle ?? sub.billing_cycle);
    const { price, token_grant: grant } = all_Types_1.PLAN_ITEMS[nextPlan];
    console.log(`[portone][${rid}] next plan=${nextPlan} cycle=${nextCycle} price=${price} grant=${grant} cancelAtEnd=${sub.cancel_at_period_end}`);
    if (sub.cancel_at_period_end === 1 || nextPlan === "FREE") {
        const [upd] = await conn.query(`UPDATE subscriptions
            SET plan_name='FREE', billing_cycle='MONTHLY', price_cents=0, token_grant=0,
                pending_plan_name=NULL, pending_billing_cycle=NULL, cancel_at_period_end=0,
                current_period_end=NULL, updated_at=NOW()
          WHERE id = ?`, [sub.id]);
        console.log(`[portone][${rid}] sub -> FREE result=`, upd);
        return;
    }
    const [upd2] = await conn.query(`UPDATE subscriptions
          SET plan_name=?, billing_cycle=?, price_cents=?, token_grant=?,
              current_period_end = CASE WHEN ?='MONTHLY'
                                        THEN DATE_ADD(IFNULL(current_period_end, NOW()), INTERVAL 1 MONTH)
                                        ELSE DATE_ADD(IFNULL(current_period_end, NOW()), INTERVAL 1 YEAR)
                                   END,
              pending_plan_name=NULL, pending_billing_cycle=NULL, updated_at=NOW()
        WHERE id = ?`, [nextPlan, nextCycle, price, grant, nextCycle, sub.id]);
    console.log(`[portone][${rid}] sub rollover result=`, upd2);
    if (grant > 0) {
        const [upd3] = await conn.query(`UPDATE users SET token_balance = token_balance + ? WHERE id = ?`, [grant, sub.user_id]);
        console.log(`[portone][${rid}] token grant result=`, upd3);
    }
    const [after] = await conn.query(`SELECT current_period_end FROM subscriptions WHERE id = ?`, [sub.id]);
    const nextEnd = after[0]?.current_period_end ?? null;
    console.log(`[portone][${rid}] current_period_end=`, nextEnd);
    if (price <= 0 || !nextEnd) {
        console.log(`[portone][${rid}] skip schedule (price<=0 or nextEnd null)`);
        return;
    }
    const [uRows] = await conn.query(`SELECT portone_customer_id, billing_key_status, portone_billing_key
       FROM users WHERE id = ?`, [sub.user_id]);
    console.log(`[portone][${rid}] user rows=${uRows.length}`);
    if (uRows.length === 0)
        return;
    const user = uRows[0];
    console.log(`[portone][${rid}] user billing status=${user.billing_key_status} hasKey=${!!user.portone_billing_key}`);
    if (!user.portone_customer_id || user.billing_key_status !== "ACTIVE" || !user.portone_billing_key) {
        console.log(`[portone][${rid}] skip schedule (no active billing key)`);
        return;
    }
    const [sc_rows] = await conn.query(`SELECT * FROM subscription_schedules WHERE subscription_id = ?`, [subscriptionId]);
    const [update_sub] = await conn.query(`SELECT id, user_id, plan_name, billing_cycle, current_period_end,
            pending_plan_name, pending_billing_cycle, cancel_at_period_end
       FROM subscriptions
      WHERE id = ?`, [subscriptionId]);
    sub = update_sub[0];
    const PAYMENT_ID_NEXT = encodeURIComponent(`order_${(0, uuid_1.v4)()}`);
    const url = `https://api.portone.io/payments/${PAYMENT_ID_NEXT}/schedule`;
    const headers = {
        Authorization: `PortOne ${process.env.PORTONE_API_SECRET}`,
        "Content-Type": "application/json",
    };
    const TIME_TO_PAY = (0, all_Store_1.computeNextAt)(sub.current_period_end ? new Date(sub.current_period_end) : null);
    const body = {
        payment: {
            billingKey: user.portone_billing_key,
            orderName: `정기결제 ${sc_rows.length + 1}회차`,
            amount: { total: price },
            currency: "KRW",
        },
        timeToPay: TIME_TO_PAY,
    };
    console.log(`[portone][${rid}] schedule request url=${url}`);
    console.log(`[portone][${rid}] schedule headers=`, redactObj(headers));
    console.log(`[portone][${rid}] schedule body=`, body);
    const { data: schRes } = await axios_1.default.post(url, body, { headers });
    console.log(`[portone][${rid}] schedule response=`, schRes);
    if (schRes.status >= 400) {
        throw new Error(`PortOne schedule error ${schRes.status}: ${JSON.stringify(schRes.data)}`);
    }
    const [ins] = await conn.query(`INSERT INTO subscription_schedules
        (payment_id, subscription_id, schedule_at, amount_krw, status, product_name)
     VALUES (?, ?, ?, ?, 'SCHEDULED', ?)
     ON DUPLICATE KEY UPDATE
        schedule_at=VALUES(schedule_at),
        amount_krw=VALUES(amount_krw),
        product_name=VALUES(product_name)`, [PAYMENT_ID_NEXT, subscriptionId, (0, all_Store_1.formatDateTime)(nextEnd), price, nextPlan]);
    console.log(`[portone][${rid}] schedule INSERT result=`, ins);
}
exports.commitCycleAndGrantTokens = commitCycleAndGrantTokens;
async function onPaymentSucceeded(conn, paymentId, opts) {
    const rid = opts?.rid ?? "";
    // 1) 스케줄 잠금 조회 → 금액/상품명/구독ID 확보
    const [sRows] = await conn.query(`SELECT subscription_id, amount_krw, product_name, status
       FROM subscription_schedules
      WHERE payment_id = ?
      FOR UPDATE`, [paymentId]);
    if (sRows.length === 0) {
        console.warn(`[portone][${rid}] onPaymentSucceeded: unknown paymentId=${paymentId}`);
        return;
    }
    const sch = sRows[0];
    // 2) 구독 → user_id 확보
    const [subRows] = await conn.query(`SELECT id, user_id FROM subscriptions WHERE id = ?`, [sch.subscription_id]);
    if (subRows.length === 0) {
        console.warn(`[portone][${rid}] onPaymentSucceeded: subscription not found id=${sch.subscription_id}`);
        return;
    }
    const { id: subscriptionId, user_id: userId } = subRows[0];
    // 3) 스케줄 상태 업데이트(멱등)
    if (sch.status === "SCHEDULED") {
        await conn.query(`UPDATE subscription_schedules
          SET status='EXECUTED', executed_at=NOW()
        WHERE payment_id=? AND status='SCHEDULED'`, [paymentId]);
    }
    // 4) payments 성공 기록(멱등: payment_id UNIQUE 가정)
    const orderName = sch.product_name || "정기결제(성공)";
    const portoneTxId = opts?.portoneTxId ?? null;
    const [ins_pay] = await conn.query(`INSERT INTO payments
       (user_id, subscription_id, payment_id, portone_tx_id, order_name,
        amount_krw, currency, is_success, paid_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'KRW', 1, NOW(), NOW())`, [userId, subscriptionId, paymentId, portoneTxId, orderName, sch.amount_krw]);
    console.log(`[portone][${rid}] payments INSERT(success) =`, ins_pay);
}
exports.onPaymentSucceeded = onPaymentSucceeded;
exports.default = router;
//# sourceMappingURL=portoneWebhook.js.map