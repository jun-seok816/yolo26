import axios, { AxiosError } from "axios";
import {
  SubscriptionRow,
  UserRow,
  PlanName,
  PlanMeta,
  PLAN_ITEMS,
  SubscriptionScheduleRow,
  PaymentsRow,
  PaymentsPublic,
} from "@BackEnd/src/all_Types";
import { Main } from "./Main_class";
import { toSlug } from "@BackEnd/src/all_Store";

interface StoreState {
  user: UserRow | null;
  subscription: SubscriptionRow | null;
  /** PLAN_ITEMS + 청구 정보가 병합된 런타임 메타 */
  planMeta: PlanMeta | null;
  schedule: SubscriptionScheduleRow[] | null;
  payments: PaymentsPublic[] | null;
}

export class SubscriptionStore {
  private state: StoreState = {
    user: null,
    subscription: null,
    planMeta: null,
    schedule: null,
    payments:null,
  };

  private im_forceRender: () => void;

  constructor(im_forceRender: () => void) {
    this.im_forceRender = im_forceRender;
  }

  get user() {
    return this.state.user;
  }

  get subscription() {
    return this.state.subscription;
  }

  get schedule(){
    return this.state.schedule;
  }

  get payments(){
    return this.state.payments;
  }

  /** 현재 플랜의 메타(가격·토큰·기능 목록) */
  get planMeta(): PlanMeta | null {
    return this.state.planMeta;
  }

  /** 현재 플랜 이름 편의 접근자 */
  get planName(): PlanName | null {
    return this.state.subscription?.plan_name ?? null;
  }

  public async callFeature(label: string) {
    const slug = toSlug(label);
    try {
      const { data } = await axios.post(`/feature/${slug}`);
      const { msg, cost } = data;
      if (this.state.user?.token_balance) {
        
        if(this.state.user.token_balance > cost){
          this.state.user.token_balance -= cost;
          this.im_forceRender();
        }
        
      }
      Main.im_toast(msg, "success");
    } catch (e) {
      if (axios.isAxiosError(e) && e.response) {
        const { err, msg } = e.response.data;
        console.error("API Error:", msg); 
        Main.im_toast(msg, "error");
      } else {
        console.error(e);
        Main.im_toast("네트워크 오류가 발생했습니다.", "error");
      }
    }
  }

  public async periodChange(){
    try {
      await axios.post<SubscriptionRow>(
        "/subscription/periodChange",
        { changeDateTime: this.subscription?.current_period_end }
      );
      this.load();
      
    } catch (e) {
      if (axios.isAxiosError(e) && e.response) {
        const { err, msg } = e.response.data;
        Main.im_toast(msg, "error");
      } else {
        console.error(e);
        Main.im_toast("네트워크 오류가 발생했습니다.", "error");
      }
    }
  }
  
  public async load(): Promise<void> {
    try {
      // 사용자 정보
      const userRes = await axios.post<UserRow>("/subscription/me");
      // 구독 정보 (1행)
      type load_res = {
        sub: SubscriptionRow;
        schedules: SubscriptionScheduleRow[];
        payments:PaymentsPublic[];
      };
      const subRes = await axios.post<load_res>("/subscription/load");

      const user = userRes.data;
      const sub = subRes.data.sub;
      const schedule = subRes.data.schedules;
      const payments = subRes.data.payments;

      // ③ PLAN_ITEMS 와 병합
      const planMeta: PlanMeta = {
        plan_name: sub.plan_name,
        billing_cycle: sub.billing_cycle,
        price_cents: sub.price_cents,
        token_grant: sub.token_grant,
        items: PLAN_ITEMS[sub.plan_name].features,
      };

      // ④ 상태 저장
      this.state = { user, subscription: sub, planMeta, schedule ,payments };

      this.im_forceRender();
    } catch (e) {
      if (axios.isAxiosError(e) && e.response) {
        const { err, msg } = e.response.data;
        console.error("API Error:", msg); // 👉 에러 메시지 사용
        Main.im_toast(msg, "error");
      } else {
        console.error(e);
        Main.im_toast("네트워크 오류가 발생했습니다.", "error");
      }
    }
  }

  public async change(plan_name: number): Promise<void> {
    try {
      const subRes = await axios.post<SubscriptionRow>(
        "/subscription/planChange",
        { plan_name }
      );
      this.load();
      
    } catch (e) {
      if (axios.isAxiosError(e) && e.response) {
        const { err, msg } = e.response.data;
        Main.im_toast(msg, "error");
      } else {
        console.error(e);
        Main.im_toast("네트워크 오류가 발생했습니다.", "error");
      }
    }
  }


  /** 토큰 잔액 갱신용 메서드(예: 결제/차감 후) */
  public updateTokenBalance(delta: number) {
    if (!this.state.user) return;
    this.state.user.token_balance += delta;
  }
}
