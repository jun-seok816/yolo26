"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_ITEMS = exports.PLAN_RANK = void 0;
exports.PLAN_RANK = {
    FREE: 0,
    BASIC: 1,
    PRO: 2,
};
exports.PLAN_ITEMS = {
    FREE: {
        price: 0,
        token_grant: 100,
        features: [
            { label: "Image", badge: "-10", disabled: false },
            { label: "Image Editing", badge: "-20", disabled: true },
            { label: "Video", badge: "-25", disabled: true },
            { label: "Document", badge: "-30", disabled: true },
            { label: "Custom Model", badge: "-35", disabled: true },
            { label: "Video Editing", badge: "-50", disabled: true },
        ],
    },
    BASIC: {
        price: 2000,
        token_grant: 200,
        features: [
            { label: "Image", badge: "-10", disabled: false },
            { label: "Image Editing", badge: "-20", disabled: false },
            { label: "Video", badge: "-25", disabled: true },
            { label: "Document", badge: "-30", disabled: true },
            { label: "Custom Model", badge: "-35", disabled: true },
            { label: "Video Editing", badge: "-50", disabled: true },
        ],
    },
    PRO: {
        price: 4000,
        token_grant: 300,
        features: [
            { label: "Image", badge: "-10", disabled: false },
            { label: "Image Editing", badge: "-20", disabled: false },
            { label: "Video", badge: "-25", disabled: false },
            { label: "Document", badge: "-30", disabled: false },
            { label: "Custom Model", badge: "-35", disabled: false },
            { label: "Video Editing", badge: "-50", disabled: false },
        ],
    },
};
//# sourceMappingURL=all_Types.js.map