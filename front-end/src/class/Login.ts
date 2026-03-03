import axios from "axios";
import { Main } from "./Main_class";

export class Login {
  public im_forceRender: () => void;
  public iv_email: string;
  public iv_sessionData:
    | {
        email: string;
        is_login: boolean;
      }
    | undefined;

  public iv_modal: boolean = false;

  constructor(im_forceRender: () => void) {
    this.im_forceRender = im_forceRender;
    this.iv_email = "";
    this.iv_sessionData = undefined;
  }

  public async im_loginCheck() {
    const email = (this.iv_email || "").trim();

    if (!email) {
      Main.im_toast("이메일을 입력해 주세요.", "warn");
      return;
    }

    // 기본 형식 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Main.im_toast("이메일 형식이 올바르지 않습니다.", "warn");
      return;
    }

    // 허용 도메인만 통과
    const allowedDomains = ["naver.com", "gmail.com", "daum.net", "kakao.com"];
    const domain = email.split("@")[1]?.toLowerCase();

    if (!domain || !allowedDomains.includes(domain)) {
      Main.im_toast(
        `허용되지 않은 이메일 도메인입니다. 사용 가능: ${allowedDomains.join(
          ", "
        )}`,
        "warn"
      );
      return;
    }

    try {
      /* 1) 이메일 존재 여부 확인 */
      await axios.post("/login/loginEmailCheck", { email: this.iv_email });

      window.location.reload();
    } catch (err) {
      Main.im_toast("로그인 에러", "warn");
    }
  }

  public async im_Session() {
    await axios.get("/login/loginSession").then((res) => {
      if (res.data.loggedIn == true) {
        this.iv_sessionData = {
          email: res.data.email,
          is_login: true,
        };
      } else {
        this.iv_modal = true;
      }
      this.im_forceRender();
    });
  }
  public async im_Logout() {
    try {
      // 서버에서 세션/쿠키 정리
      await axios.post("/login/logout"); // 필요 시 GET으로 교체: await axios.get("/login/logout");

      // 클라이언트 상태 초기화
      this.iv_sessionData = { email: "", is_login: false };
      this.iv_modal = true; // 로그인 모달 다시 띄울 경우

      Main.im_toast("로그아웃되었습니다.", "info");
    } catch (err) {
      Main.im_toast("로그아웃 중 오류가 발생했습니다.", "error");
      console.error(err);
    } finally {      
      window.location.reload();
    }
  }

  public static sf_emailCheck(value: string) {
    var reg =
      /^[0-9a-zA-Z]([-_\.]?[0-9a-zA-Z])*@[0-9a-zA-Z]([-_\.]?[0-9a-zA-Z])*\.[a-zA-Z]{2,3}$/i;
    return reg.test(value);
  }
}
