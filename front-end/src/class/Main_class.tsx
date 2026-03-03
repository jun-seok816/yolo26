import React, { RefObject, useEffect } from "react";

export class Main {
  private iv_UpdateData!: React.Dispatch<React.SetStateAction<object>>;
  public iv_navigate: any;
  private iv_Prepared: boolean = false;
  private iv_RenderCount = 0;
  public get pt_RenderCount() {
    return this.iv_RenderCount;
  }

  constructor() {}

  //                                                     +------------------------------
  //-----------------------------------------------------+ Hooks
  //                                                     +------------------------------
  /**
   * @description
   *   Hooks Component 시작점에서 호출 되어야 한다.
   *
   * @Revision
   *   00. Job    : Create
   *       Date   : 2022.7.24
   *       Worker : junseok816@gmail.com
   *       Note   :
   */
  public im_Prepare_Hooks(p_FirstRender?: () => void) {
    [, this.iv_UpdateData] = React.useState({});
    this.iv_Prepared = true;
    this.iv_RenderCount++;

    if (this.iv_RenderCount === 1) {
      if (p_FirstRender) p_FirstRender();
    }
  }
  //                                                     +------------------------------
  //-----------------------------------------------------+ Render
  //                                                     +------------------------------
  /**
   * @description
   *   Hooks Component 에서 Render 가 발행하도록 한다.
   *
   * @Revision
   *   00. Job    : Create
   *       Date   : 2022.7.24
   *       Worker : junseok816@gmail.com
   *       Note   :
   */
  public im_forceRender() {
    if (!this.iv_Prepared) return;
    this.iv_UpdateData({});
  }
  //                                                     +------------------------------
  //-----------------------------------------------------+ Lifecycle
  //                                                     +------------------------------
  /**
   * @description
   *   Hooks Component 의 Mounted 시점
   *   보통 Event 연결작업을 한다.
   *
   * @Revision
   *   00. Job    : Create
   *       Date   : 2022.7.24
   *       Worker : junseok816@gmail.com
   *       Note   :
   */
  public im_Mounted(p_Callback: () => void) {
    useEffect(p_Callback, []);
  }

  public im_Mounted_byData(p_Callback: () => void, p_data: any) {
    useEffect(p_Callback, p_data);
  }

  /**
   * @description
   *   Hooks Component 의 UnMounted 시점
   *   보통 Cleanup 작업을 위해서 사용한다.
   *
   * @Revision
   *   00. Job    : Create
   *       Date   : 2022.2.24
   *       Worker : junseok816@gmail.com
   *       Note   :
   */
  public im_UnMounted(p_Callback: () => void) {
    useEffect(() => {
      return p_Callback;
    }, []);
  }

  public im_navigate(p_path: string | number) {
    // 스크롤을 페이지의 최상단 왼쪽으로 초기화
    document.body.scrollTop = 0; // For Safari
    document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
    document.body.scrollLeft = 0; // X축 스크롤 초기화 (필요시)
    document.documentElement.scrollLeft = 0; // X축 스크롤 초기화 (필요시)
    this.iv_navigate(p_path);
  }

}
