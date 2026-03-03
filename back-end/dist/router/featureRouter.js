"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureRouter = void 0;
const all_Store_1 = require("../all_Store");
const express_1 = require("express");
const all_Types_1 = require("../all_Types");
function featureRouter() {
    const router = (0, express_1.Router)();
    const labels = Array.from(new Set(Object.values(all_Types_1.PLAN_ITEMS).flatMap((p) => p.features.map((f) => f.label))));
    for (const label of labels) {
        const path = `/feature/${(0, all_Store_1.toSlug)(label)}`;
        router.post(path, process._myApp.checkSession, async (req, res) => {
            const userId = Number((req.session.userId));
            try {
                const [[sub]] = await process._myApp.db.promise().query("SELECT plan_name FROM subscriptions WHERE user_id = ?", [userId]);
                const planName = (sub?.plan_name?.toUpperCase?.() ?? "FREE");
                const plan = all_Types_1.PLAN_ITEMS[planName] ?? all_Types_1.PLAN_ITEMS.FREE;
                const feat = plan.features.find((f) => f.label === label);
                if (!feat || feat.disabled) {
                    res.json({ err: true, msg: `${planName} 플랜에서 ${label} 사용 불가` });
                    return;
                }
                const cost = Math.abs(parseInt(feat.badge, 10));
                if (!Number.isFinite(cost) || cost <= 0) {
                    res.json({ err: true, msg: "차감 금액 계산 실패" });
                    return;
                }
                const [r] = await process._myApp.db.promise().query("UPDATE users SET token_balance = token_balance - ? WHERE id = ? AND token_balance >= ?", [cost, userId, cost]);
                if (r.affectedRows !== 1) {
                    res.json({ err: true, msg: `토큰 부족: ${cost} 필요` });
                    return;
                }
                res.json({ err: false, msg: `${label} 실행됨. ${cost} 토큰 차감`, cost });
            }
            catch (e) {
                console.error(e);
                res.json({ err: true, msg: "오류" });
            }
        });
    }
    return router;
}
exports.featureRouter = featureRouter;
//# sourceMappingURL=featureRouter.js.map