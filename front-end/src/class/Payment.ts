import axios from "axios";
import * as PortOne from "@portone/browser-sdk/v2";
import { Main } from "./Main_class";
import { v4 } from "uuid";
import { uniqueId } from "lodash";

const STORE_ID = "store-1bf4f4b6-f07e-4415-8d81-1fca605c699f";
const PORTONE_API_SECRET = "channel-key-ce371e74-f728-4b88-92c1-6374ba1dd8b5";

export class Payment {
  async im_handlePayment(): Promise<boolean> {
    try {
      const paymentId = `payment_${uniqueId()}`;
      const response = await PortOne.requestPayment({
        storeId: STORE_ID,
        channelKey: PORTONE_API_SECRET,
        paymentId,
        orderName: "테스트 상품",
        totalAmount: 1000,
        currency: "CURRENCY_KRW",
        payMethod: "EASY_PAY",
      });

      if (!response) throw Error("no res");

      if (response.code !== undefined) {
        console.error("PortOne SDK Error:", response);
        Main.im_toast("결제 실패", "error");
        return false;
      }

      //결제 성공 → 백엔드 검증 호출
      const result = await axios.post("/pay/complete", {
        paymentId: response.paymentId,
      });

      if (result.data.err) {
        Main.im_toast(result.data.msg, "error");
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  async im_deleteBillingKey() {
    try {
      const res = await axios.delete('/pay/billing'); // 200/204이면 성공
      // console.log(res.status); // 204(No Content)일 수도 있음. data는 비어있어도 정상
      window.location.reload(); // 혹은: window.location.href = window.location.href;
    } catch (err:any) {
      Main.im_toast(err?.response?.data?.msg ?? '삭제에 실패했습니다.', 'error');
    }
    
  }

  async im_issueBillingKey(userEmail: string | undefined): Promise<boolean> {
    if (!userEmail) {
      Main.im_toast("사용자 정보 load 실패", "error");
      return false;
    }
    const customerId = v4();
    try {
      const response = await PortOne.requestIssueBillingKey({
        storeId: STORE_ID,
        channelKey: PORTONE_API_SECRET,
        billingKeyMethod: "EASY_PAY", // 카드 결제창
        issueId: `issue_${uniqueId()}`,
        issueName: "정기구독 카드등록",
        customer: { customerId: customerId, email: userEmail },
      });

      if (!response) throw Error("no res");

      if (response.code !== undefined) {
        console.error("PortOne SDK Error:", response);
        Main.im_toast("결제 실패", "error");
        return false;
      }

      const result = await axios.post("/pay/billing", {
        billingKey: response.billingKey,
        userEmail: userEmail,
        customerId: customerId,
      });

      if (result.data.err) {
        Main.im_toast(result.data.msg, "error");
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }
}
