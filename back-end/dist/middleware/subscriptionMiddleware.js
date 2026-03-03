"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rollToNextPeriod = exports.applyPlanChange = exports.loadSubscription = void 0;
const all_Types_1 = require("../all_Types");
const loadSubscription = async (req, res, next) => {
    const userId = req.session.userId;
    try {
        const [rows] = await process._myApp.db
            .promise()
            .query("SELECT * FROM subscriptions WHERE user_id = ?", [userId]);
        const [user] = await process._myApp.db
            .promise()
            .query("SELECT * FROM users WHERE id = ?", [userId]);
        res.locals.subscription = rows[0] ?? null;
        const [subscription_schedules] = await process._myApp.db
            .promise()
            .query("SELECT * FROM subscription_schedules WHERE subscription_id = ? ORDER BY created_at DESC", [res.locals.subscription.id]);
        const [payments] = await process._myApp.db
            .promise()
            .query("SELECT payment_id,order_name,is_success,amount_krw,paid_at FROM payments WHERE user_id = ? ORDER BY paid_at DESC ", [userId]);
        res.locals.subscription_schedules = subscription_schedules ?? null;
        res.locals.payments = payments ?? null;
        res.locals.user = user[0] ?? null;
        next();
    }
    catch (err) {
        console.log(err);
        next(err);
    }
};
exports.loadSubscription = loadSubscription;
// ---------------------------------------------------------------------------
// applyPlanChange  ─ 트랜잭션으로 구독 업데이트 & 토큰 증감
// ---------------------------------------------------------------------------
const applyPlanChange = async (req, res, next) => {
    const planIdx = Number(req.body.plan_name);
    const user_id = req.session.userId;
    // ─── 1) 파라미터·세션 유효성 ─────────────────────────
    if (Number.isNaN(planIdx) || !user_id) {
        res.status(400).json({ err: true, msg: "잘못된 요청입니다." });
        return;
    }
    const newPlan = Object.keys(all_Types_1.PLAN_ITEMS)[planIdx];
    if (!newPlan) {
        res.status(400).json({ err: true, msg: "존재하지 않는 플랜입니다." });
        return;
    }
    const conn = await process._myApp.db.promise().getConnection();
    try {
        await conn.beginTransaction();
        // ─── 2) 현재 구독 행 잠금 조회 ─────────────────────
        const [[sub]] = await conn.query(`SELECT plan_name, pending_plan_name
         FROM subscriptions
        WHERE user_id = ?
        FOR UPDATE`, [user_id]);
        if (!sub) {
            await conn.rollback();
            res.status(404).json({ err: true, msg: "구독 정보를 찾을 수 없습니다." });
            return;
        }
        // ─── 3) 이미 동일 플랜이면 충돌 ─────────────────────
        const isSameAsCurrent = sub.plan_name === newPlan &&
            (!sub.pending_plan_name || sub.pending_plan_name === newPlan);
        if (isSameAsCurrent) {
            await conn.rollback();
            res
                .status(409)
                .json({ err: true, msg: "이미 사용 중(예약)인 플랜입니다." });
            return;
        }
        const isUpgrade = all_Types_1.PLAN_RANK[newPlan] > all_Types_1.PLAN_RANK[sub.plan_name];
        res.locals.planChange = isUpgrade
            ? "UPGRADE"
            : "DOWNGRADE";
        // ─── 4) 업그레이드 경로 ────────────────────────────
        if (isUpgrade) {
            await conn.query(`UPDATE subscriptions
            SET plan_name         = ?,
                billing_cycle     = 'MONTHLY',
                price_cents = ?,
                current_period_end = DATE_ADD(NOW(), INTERVAL 1 MONTH),
                pending_plan_name     = NULL,
                pending_billing_cycle = NULL,
                cancel_at_period_end  = 0,
                updated_at            = NOW()
          WHERE user_id = ?`, [newPlan, all_Types_1.PLAN_ITEMS[newPlan].price, user_id]);
            // 즉시 토큰 지급 예시
            const addToken = all_Types_1.PLAN_ITEMS[newPlan].token_grant;
            if (addToken > 0) {
                await conn.query(`UPDATE users SET token_balance = token_balance + ? WHERE id = ?`, [addToken, user_id]);
            }
        }
        // ─── 5) 다운그레이드(예약) 경로 ────────────────────
        else {
            if (sub.pending_plan_name === newPlan) {
                await conn.rollback();
                res.status(409).json({
                    err: true,
                    msg: "이미 다음 주기에 동일 플랜이 예약되어 있습니다.",
                });
                return;
            }
            await conn.query(`UPDATE subscriptions
            SET pending_plan_name     = ?,
                price_cents = ?,
                pending_billing_cycle = 'MONTHLY',
                cancel_at_period_end  = 0,
                updated_at            = NOW()
          WHERE user_id = ?`, [newPlan, all_Types_1.PLAN_ITEMS[newPlan].price, user_id]);
        }
        await conn.commit();
        next();
    }
    catch (err) {
        await conn.rollback();
        console.log(err);
        next(err);
    }
    finally {
        conn.release();
    }
};
exports.applyPlanChange = applyPlanChange;
// ▸ 다음 주기로 이동 미들웨어 ---------------------------------------------
const rollToNextPeriod = async (req, res, next) => {
    const user_id = req.session.userId;
    if (!user_id) {
        res.status(401).json({ err: true, msg: "로그인이 필요합니다." });
        return;
    }
    const conn = await process._myApp.db.promise().getConnection();
    try {
        await conn.beginTransaction();
        // 1) 현재 구독 행 잠금
        const [[sub]] = await conn.query(`SELECT *
         FROM subscriptions
        WHERE user_id = ?
        FOR UPDATE`, [user_id]);
        if (!sub) {
            await conn.rollback();
            res.status(404).json({ err: true, msg: "구독 정보를 찾을 수 없습니다." });
            return;
        }
        if (sub.current_period_end > new Date()) {
            await conn.rollback();
            res.status(400).json({
                err: true,
                msg: "아직 구독 기간이 끝나지 않았습니다.",
            });
            return;
        }
        /* ────────────────────────────────────────────────────────────── */
        const nextPlan = sub.pending_plan_name || sub.plan_name;
        /* 3) 해지 예약인 경우 → 행 FREE 전환 */
        if (sub.cancel_at_period_end || nextPlan === "FREE") {
            await conn.query(`UPDATE subscriptions
            SET plan_name            = 'FREE',
                billing_cycle        = 'MONTHLY',      
                price_cents          = 0,
                token_grant          = 0,
                pending_plan_name    = NULL,
                pending_billing_cycle= NULL,
                cancel_at_period_end = 0,              -- 플래그 해제
                current_period_end   = NULL            -- 무료라서 기간 무의미
          WHERE user_id = ?`, [user_id]);
            await conn.commit();
            next();
            return;
        }
        /* 4) 다음 주기 플랜·주기 결정 */
        const nextCycle = sub.pending_billing_cycle || sub.billing_cycle;
        const price = all_Types_1.PLAN_ITEMS[nextPlan].price;
        const grant = all_Types_1.PLAN_ITEMS[nextPlan].token_grant;
        /* 5) 롤오버 + 예약 해제 */
        await conn.query(`UPDATE subscriptions
      SET
        plan_name            = ?,     
        billing_cycle        = ?,     
        price_cents          = ?,     
        token_grant          = ?,     
        current_period_end   = CASE
                                 WHEN ? = 'MONTHLY'            
                                 THEN DATE_ADD(current_period_end, INTERVAL 1 MONTH)
                                 ELSE DATE_ADD(current_period_end, INTERVAL 1 YEAR)
                               END,
        pending_plan_name    = NULL,
        pending_billing_cycle= NULL,
        updated_at           = NOW()
      WHERE user_id = ?`, [nextPlan, nextCycle, price, grant, nextCycle, user_id]);
        /* 6) 주기당 토큰 지급 */
        if (grant > 0) {
            await conn.query(`UPDATE users SET token_balance = token_balance + ? WHERE id = ?`, [grant, user_id]);
        }
        await conn.commit();
        next();
    }
    catch (err) {
        await conn.rollback();
        next(err); // 전역 핸들러가 { err:true, msg } 포맷으로 변환
    }
    finally {
        conn.release();
    }
};
exports.rollToNextPeriod = rollToNextPeriod;
//# sourceMappingURL=subscriptionMiddleware.js.map