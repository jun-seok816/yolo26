export interface SubscriptionRow {
  id: number; // PK
  user_id: number; // 유저 ID(FK)
  plan_name: PlanName; // 요금제 이름
  billing_cycle: "MONTHLY" | "YEARLY"; // 청구 주기
  price_cents: number; // 실제 청구 금액(cent 단위)
  token_grant: number; // 주기별 지급 토큰
  current_period_end: Date; // 현재 결제 주기 종료 시점
  pending_plan_name: PlanName | null; // 예약 플랜(다운그레이드 등)
  pending_billing_cycle: "MONTHLY" | "YEARLY" | null; // 예약 주기
  cancel_at_period_end: 0 | 1; // 주기 종료 후 해지 여부
  updated_at: Date; // 마지막 갱신 시간
}

export type PlanName = "FREE" | "BASIC" | "PRO";

export interface FeatureItem {
  label: string;
  /** 사용 시 차감 토큰(문자 그대로 '-10' 형식) */
  badge: string;
  /** 플랜에서 비활성화 여부 */
  disabled: boolean;
}

export interface Plan {
  price: number;            // 플랜 가격 (USD, KRW 등)
  token_grant:number;
  features: FeatureItem[];  // 해당 플랜의 토큰 사용 항목 목록
}

export type PlanMeta = Pick<
  SubscriptionRow,
  "plan_name" | "billing_cycle" | "price_cents" | "token_grant"
> & {
  items: FeatureItem[];
};

export const PLAN_RANK: Record<PlanName, number> = {
  FREE: 0,
  BASIC: 1,
  PRO: 2,
};

export const PLAN_ITEMS: Record<PlanName, Plan> = {
  FREE: {
    price: 0,
    token_grant:100,
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
    token_grant:200,
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
    token_grant:300,
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

export interface UserRow {  
  email: string;                           // VARCHAR(255)
  token_balance: number;                   // INT
  created_at: Date;                        // DATETIME    
  billing_key_status: Billing_key_status;  // enum
  card_brand: string | null;               // VARCHAR(50) | NULL
  card_last4: string | null;               // CHAR(4) | NULL 
  easy_pay_provider: string | null;        // VARCHAR(50) | NULL
  billing_key_created_at: Date | null;     // DATETIME | NULL
  billing_key_updated_at: Date | null;     // DATETIME | NULL
}

export type Billing_key_status = 'ACTIVE' | 'INACTIVE' | 'REVOKED';

export interface SubscriptionScheduleRow {
  cancelled_at: string | Date | null ;
  executed_at: string | Date | null ;  
  payment_id: string;
  subscription_id: number;
  schedule_at: string | Date;
  amount_krw: number;
  status: ScheduleStatus; 
  created_at: string | Date;  
  product_name:string;
}

export type PlanChangeType = "UPGRADE" | "DOWNGRADE" | "SAME";

export type ScheduleStatus = "SCHEDULED" | "EXECUTED" | "CANCELLED";

export type PaymentsRow = {
  id: number;
  user_id: number;
  subscription_id: number | null;
  payment_id: string;
  portone_tx_id: string | null;
  order_name: string;
  amount_krw: number;
  currency: string;          
  paid_at: string;           
  created_at: string;   
  is_success:0|1;     
};

export type PaymentsPublic = Pick<
  PaymentsRow,
  "id" | "subscription_id" | "order_name" | "amount_krw" | "currency" | "paid_at" | "is_success"
>;
