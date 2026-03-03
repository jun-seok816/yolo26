"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const subscriptionMiddleware_1 = require("../middleware/subscriptionMiddleware");
const express_1 = __importDefault(require("express"));
const billingKeyMiddleware_1 = require("../middleware/billingKeyMiddleware");
const scheduleMiddleware_1 = require("../middleware/scheduleMiddleware");
const router = express_1.default.Router();
router.post("/billing", process._myApp.checkSession, billingKeyMiddleware_1.createBillingKey, (req, res) => {
    res.send({});
});
router.delete("/billing", process._myApp.checkSession, subscriptionMiddleware_1.loadSubscription, scheduleMiddleware_1.cancelPortoneSchedules, billingKeyMiddleware_1.deleteBillingKey, (req, res) => {
    res.send({});
});
exports.default = router;
//# sourceMappingURL=paymentRouter.js.map