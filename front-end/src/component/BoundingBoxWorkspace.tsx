import React, { useRef, useState } from "react";
import "./BoundingBoxWorkspace.scss";
import { Main } from "@jsLib/class/Main";

type RouterImageListResponse = {
  err?: boolean;
  images?: string[];
  msg?: string;
};

type RouterImageItem = {
  id: string;
  relativePath: string;
  url: string;
};

type BoundingBox = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
};

type ImageSize = {
  width: number;
  height: number;
};

type CanvasSize = {
  width: number;
  height: number;
  scale: number;
};

type DragState =
  | { mode: "idle" }
  | { mode: "drawing"; startX: number; startY: number }
  | { mode: "moving"; boxId: string; offsetX: number; offsetY: number };

const DEFAULT_LABEL = "object";
const MIN_BOX_SIZE = 4;
const MAX_CANVAS_WIDTH = 860;
const MAX_CANVAS_HEIGHT = 640;
const MIN_ZOOM_SCALE = 0.2;
const MAX_ZOOM_SCALE = 5;
const ZOOM_STEP = 0.2;

const gf_clamp = (p_value: number, p_min: number, p_max: number) => {
  return Math.max(p_min, Math.min(p_value, p_max));
};

const gf_toImageUrl = (p_relativePath: string) => {
  return `/images/${p_relativePath
    .split("/")
    .filter((p_segment) => p_segment.length > 0)
    .map((p_segment) => encodeURIComponent(p_segment))
    .join("/")}`;
};

class BoundingBoxWorkspaceData extends Main {
  private iv_images: RouterImageItem[] = [];
  private iv_currentIndex = 0;
  private iv_boxesByImage: Record<string, BoundingBox[]> = {};
  private iv_selectedBoxId: string | null = null;
  private iv_draftBox: BoundingBox | null = null;
  private iv_isLoadingImage = false;
  private iv_statusMessage = "라우터 이미지 목록을 불러오는 중입니다.";
  private iv_labelInput = DEFAULT_LABEL;
  private iv_naturalSize: ImageSize = { width: 0, height: 0 };

  private iv_canvasElement: HTMLCanvasElement | null = null;
  private iv_loadedImage: HTMLImageElement | null = null;
  private iv_dragState: DragState = { mode: "idle" };
  private iv_boxSequence = 1;
  private iv_imageLoadSequence = 0;
  private iv_drawToken = 0;
  private iv_zoomScale = 1;

  /**
   * @description 현재 로드된 이미지 목록 반환
   */
  public get pt_images(): RouterImageItem[] {
    return this.iv_images;
  }

  /**
   * @description 현재 선택 인덱스 반환
   */
  public get pt_currentIndex(): number {
    return this.iv_currentIndex;
  }

  /**
   * @description 현재 선택 이미지 반환 (없으면 null)
   */
  public get pt_currentImage(): RouterImageItem | null {
    return this.iv_images[this.iv_currentIndex] || null;
  }

  /**
   * @description 현재 이미지의 바운딩 박스 목록 반환
   */
  public get pt_currentBoxes(): BoundingBox[] {
    const lv_currentImage = this.pt_currentImage;
    if (!lv_currentImage) return [];
    return this.iv_boxesByImage[lv_currentImage.id] || [];
  }

  /**
   * @description 현재 선택된 박스 ID 반환
   */
  public get pt_selectedBoxId(): string | null {
    return this.iv_selectedBoxId;
  }

  /**
   * @description 현재 선택된 박스 객체 반환
   */
  public get pt_selectedBox(): BoundingBox | null {
    if (!this.iv_selectedBoxId) return null;
    return this.pt_currentBoxes.find((p_box) => p_box.id === this.iv_selectedBoxId) || null;
  }

  /**
   * @description 드래그 중 임시 박스 정보 반환
   */
  public get pt_draftBox(): BoundingBox | null {
    return this.iv_draftBox;
  }

  /**
   * @description 현재 이미지 로딩 상태 반환
   */
  public get pt_isLoadingImage(): boolean {
    return this.iv_isLoadingImage;
  }

  /**
   * @description 상태 메시지 반환
   */
  public get pt_statusMessage(): string {
    return this.iv_statusMessage;
  }

  /**
   * @description 라벨 입력값 반환
   */
  public get pt_labelInput(): string {
    return this.iv_labelInput;
  }

  /**
   * @description 원본 이미지 크기(px) 반환
   */
  public get pt_naturalSize(): ImageSize {
    return this.iv_naturalSize;
  }

  /**
   * @description 캔버스 렌더 크기와 스케일 반환
   */
  public get pt_canvasSize(): CanvasSize {
    if (this.iv_naturalSize.width <= 0 || this.iv_naturalSize.height <= 0) {
      return { width: 860, height: 500, scale: 1 };
    }

    const lv_baseScale = Math.min(
      MAX_CANVAS_WIDTH / this.iv_naturalSize.width,
      MAX_CANVAS_HEIGHT / this.iv_naturalSize.height,
      1
    );
    const lv_scale = lv_baseScale * this.iv_zoomScale;

    return {
      width: Math.max(1, Math.round(this.iv_naturalSize.width * lv_scale)),
      height: Math.max(1, Math.round(this.iv_naturalSize.height * lv_scale)),
      scale: lv_scale,
    };
  }

  /**
   * @description 전체 이미지 기준 총 박스 개수 반환
   */
  public get pt_totalBoxCount(): number {
    return Object.values(this.iv_boxesByImage).reduce((p_sum, p_items) => p_sum + p_items.length, 0);
  }

  /**
   * @description 선택 박스를 YOLO normalized 좌표로 반환
   */
  public get pt_selectedBoxNormalized() {
    const lv_selectedBox = this.pt_selectedBox;
    if (!lv_selectedBox || this.iv_naturalSize.width <= 0 || this.iv_naturalSize.height <= 0) {
      return null;
    }

    return {
      cx: (lv_selectedBox.x + lv_selectedBox.w / 2) / this.iv_naturalSize.width,
      cy: (lv_selectedBox.y + lv_selectedBox.h / 2) / this.iv_naturalSize.height,
      w: lv_selectedBox.w / this.iv_naturalSize.width,
      h: lv_selectedBox.h / this.iv_naturalSize.height,
    };
  }

  /**
   * @description 캔버스 재그리기 트리거용 토큰 반환
   */
  public get pt_drawToken(): number {
    return this.iv_drawToken;
  }

  /**
   * @description 현재 줌 퍼센트(%) 반환
   */
  public get pt_zoomPercent(): number {
    return Math.round(this.iv_zoomScale * 100);
  }

  /**
   * @description 내부 상태 변경 후 화면 렌더를 트리거
   */
  private im_notifyChange() {
    this.iv_drawToken += 1;
    this.im_forceRender();
  }

  /**
   * @param p_canvasElement 캔버스 DOM 엘리먼트
   * @description 캔버스 참조를 바인딩하고 즉시 렌더
   */
  public im_bindCanvasElement(p_canvasElement: HTMLCanvasElement | null) {
    if (this.iv_canvasElement === p_canvasElement) return;
    this.iv_canvasElement = p_canvasElement;
    this.im_drawScene();
  }

  /**
   * @param p_label 라벨 입력 문자열
   * @description 신규 박스 기본 라벨을 변경
   */
  public im_setLabelInput(p_label: string) {
    this.iv_labelInput = p_label;
    this.im_notifyChange();
  }

  /**
   * @description 이전 이미지로 이동
   */
  public im_movePrevImage() {
    this.im_setCurrentIndex(this.iv_currentIndex - 1);
  }

  /**
   * @description 다음 이미지로 이동
   */
  public im_moveNextImage() {
    this.im_setCurrentIndex(this.iv_currentIndex + 1);
  }

  /**
   * @description 이미지를 한 단계 확대
   */
  public im_zoomIn() {
    this.im_setZoomScale(this.iv_zoomScale + ZOOM_STEP);
  }

  /**
   * @description 이미지를 한 단계 축소
   */
  public im_zoomOut() {
    this.im_setZoomScale(this.iv_zoomScale - ZOOM_STEP);
  }

  /**
   * @description 확대 배율을 100%로 초기화
   */
  public im_resetZoom() {
    this.im_setZoomScale(1);
  }

  /**
   * @param p_zoomScale 적용할 줌 배율
   * @description 줌 범위를 보정해 배율을 반영
   */
  private im_setZoomScale(p_zoomScale: number) {
    const lv_nextZoomScale = gf_clamp(p_zoomScale, MIN_ZOOM_SCALE, MAX_ZOOM_SCALE);
    if (Math.abs(lv_nextZoomScale - this.iv_zoomScale) < 0.0001) return;

    this.iv_zoomScale = lv_nextZoomScale;
    this.im_notifyChange();
  }

  /**
   * @param p_index 이동할 목표 인덱스
   * @description 인덱스를 보정해 현재 이미지를 전환
   */
  private im_setCurrentIndex(p_index: number) {
    if (this.iv_images.length === 0) return;

    const lv_nextIndex = gf_clamp(p_index, 0, this.iv_images.length - 1);
    if (lv_nextIndex === this.iv_currentIndex) return;

    this.iv_currentIndex = lv_nextIndex;
    this.iv_dragState = { mode: "idle" };
    this.iv_draftBox = null;
    this.iv_selectedBoxId = null;
    this.im_startCurrentImageLoading();
  }

  /**
   * @description 서버 라우터(/images/list)에서 이미지 목록을 로드
   */
  public async im_loadImageList() {
    this.iv_statusMessage = "라우터 이미지 목록을 불러오는 중입니다.";
    this.im_notifyChange();

    try {
      const lv_response = await fetch("/images/list");
      if (!lv_response.ok) {
        throw new Error(`image list http status ${lv_response.status}`);
      }

      const lv_payload = (await lv_response.json()) as RouterImageListResponse;
      const lv_rawImages = Array.isArray(lv_payload.images) ? lv_payload.images : [];

      const lv_nextImages = lv_rawImages
        .map((p_relativePath, p_index) => {
          const lv_normalized = p_relativePath.replace(/\\/g, "/").replace(/^\/+/, "").trim();
          if (!lv_normalized) return null;

          return {
            id: `img_${p_index}_${lv_normalized}`,
            relativePath: lv_normalized,
            url: gf_toImageUrl(lv_normalized),
          } as RouterImageItem;
        })
        .filter((p_item): p_item is RouterImageItem => p_item !== null);

      this.iv_images = lv_nextImages;
      this.iv_currentIndex = 0;
      this.iv_boxesByImage = {};
      this.iv_selectedBoxId = null;
      this.iv_draftBox = null;
      this.iv_dragState = { mode: "idle" };

      if (lv_nextImages.length > 0) {
        this.iv_statusMessage = `라우터에서 이미지 ${lv_nextImages.length}개를 불러왔습니다.`;
      } else {
        this.iv_statusMessage = "라우터 이미지가 비어 있습니다.";
      }

      this.im_notifyChange();
      this.im_startCurrentImageLoading();
    } catch (p_error) {
      console.error("[BoundingBoxWorkspace] image list load failed:", p_error);

      this.iv_images = [];
      this.iv_currentIndex = 0;
      this.iv_boxesByImage = {};
      this.iv_selectedBoxId = null;
      this.iv_draftBox = null;
      this.iv_dragState = { mode: "idle" };
      this.iv_loadedImage = null;
      this.iv_naturalSize = { width: 0, height: 0 };
      this.iv_isLoadingImage = false;
      this.iv_statusMessage = "이미지 목록 로드에 실패했습니다. /images/list 라우트를 확인해주세요.";
      this.im_notifyChange();
    }
  }

  /**
   * @description 현재 선택 이미지를 로드하고 캔버스 상태를 갱신
   */
  private im_startCurrentImageLoading() {
    const lv_currentImage = this.pt_currentImage;

    this.iv_imageLoadSequence += 1;
    const lv_currentLoadSequence = this.iv_imageLoadSequence;

    this.iv_dragState = { mode: "idle" };
    this.iv_draftBox = null;
    this.iv_selectedBoxId = null;

    if (!lv_currentImage) {
      this.iv_loadedImage = null;
      this.iv_naturalSize = { width: 0, height: 0 };
      this.iv_isLoadingImage = false;
      this.iv_statusMessage = "이미지를 선택하면 캔버스가 활성화됩니다.";
      this.im_notifyChange();
      return;
    }

    this.iv_isLoadingImage = true;
    this.iv_statusMessage = `이미지 로딩 중: ${lv_currentImage.relativePath}`;
    this.im_notifyChange();

    const lv_image = new Image();

    lv_image.onload = () => {
      if (lv_currentLoadSequence !== this.iv_imageLoadSequence) return;

      this.iv_loadedImage = lv_image;
      this.iv_naturalSize = {
        width: lv_image.naturalWidth,
        height: lv_image.naturalHeight,
      };
      this.iv_isLoadingImage = false;
      this.iv_statusMessage = `이미지 ${this.iv_currentIndex + 1}/${this.iv_images.length} - ${lv_currentImage.relativePath}`;
      this.im_notifyChange();
    };

    lv_image.onerror = () => {
      if (lv_currentLoadSequence !== this.iv_imageLoadSequence) return;

      this.iv_loadedImage = null;
      this.iv_naturalSize = { width: 0, height: 0 };
      this.iv_isLoadingImage = false;
      this.iv_statusMessage = `이미지 로드 실패: ${lv_currentImage.relativePath}`;
      this.im_notifyChange();
    };

    lv_image.src = lv_currentImage.url;
  }

  /**
   * @param p_updater 현재 이미지 박스 목록 변경 함수
   * @description 현재 이미지의 박스 배열을 교체
   */
  private im_updateCurrentBoxes(p_updater: (p_prevBoxes: BoundingBox[]) => BoundingBox[]) {
    const lv_currentImage = this.pt_currentImage;
    if (!lv_currentImage) return;

    const lv_prevBoxes = this.iv_boxesByImage[lv_currentImage.id] || [];
    const lv_nextBoxes = p_updater(lv_prevBoxes);

    this.iv_boxesByImage = {
      ...this.iv_boxesByImage,
      [lv_currentImage.id]: lv_nextBoxes,
    };
  }

  /**
   * @param p_event 캔버스 마우스 이벤트
   * @returns 이미지 기준 좌표(px), 계산 불가 시 null
   * @description 화면 좌표를 원본 이미지 좌표로 변환
   */
  private im_getImagePointFromMouse(p_event: React.MouseEvent<HTMLCanvasElement>) {
    const lv_canvasElement = this.iv_canvasElement;
    if (!lv_canvasElement || this.iv_naturalSize.width <= 0 || this.iv_naturalSize.height <= 0) {
      return null;
    }

    const lv_rect = lv_canvasElement.getBoundingClientRect();
    if (lv_rect.width <= 0 || lv_rect.height <= 0) return null;

    const lv_canvasX = ((p_event.clientX - lv_rect.left) * lv_canvasElement.width) / lv_rect.width;
    const lv_canvasY = ((p_event.clientY - lv_rect.top) * lv_canvasElement.height) / lv_rect.height;

    return {
      x: gf_clamp(lv_canvasX / this.pt_canvasSize.scale, 0, this.iv_naturalSize.width),
      y: gf_clamp(lv_canvasY / this.pt_canvasSize.scale, 0, this.iv_naturalSize.height),
    };
  }

  /**
   * @param p_x 이미지 기준 X
   * @param p_y 이미지 기준 Y
   * @returns 히트된 박스 또는 null
   * @description 지정 좌표에 포함된 최상단 박스를 탐색
   */
  private im_findHitBox(p_x: number, p_y: number): BoundingBox | null {
    const lv_currentBoxes = this.pt_currentBoxes;

    for (let lv_i = lv_currentBoxes.length - 1; lv_i >= 0; lv_i -= 1) {
      const lv_box = lv_currentBoxes[lv_i];
      if (
        p_x >= lv_box.x &&
        p_x <= lv_box.x + lv_box.w &&
        p_y >= lv_box.y &&
        p_y <= lv_box.y + lv_box.h
      ) {
        return lv_box;
      }
    }

    return null;
  }

  /**
   * @param p_event 캔버스 마우스 다운 이벤트
   * @description 박스 선택/이동 시작 또는 신규 박스 드로잉 시작
   */
  public im_handleMouseDown(p_event: React.MouseEvent<HTMLCanvasElement>) {
    if (!this.pt_currentImage || !this.iv_loadedImage) return;

    const lv_point = this.im_getImagePointFromMouse(p_event);
    if (!lv_point) return;

    const lv_hitBox = this.im_findHitBox(lv_point.x, lv_point.y);
    if (lv_hitBox) {
      this.iv_selectedBoxId = lv_hitBox.id;
      this.iv_dragState = {
        mode: "moving",
        boxId: lv_hitBox.id,
        offsetX: lv_point.x - lv_hitBox.x,
        offsetY: lv_point.y - lv_hitBox.y,
      };
      this.im_notifyChange();
      return;
    }

    this.iv_selectedBoxId = null;
    this.iv_dragState = {
      mode: "drawing",
      startX: lv_point.x,
      startY: lv_point.y,
    };
    this.iv_draftBox = {
      id: "draft",
      x: lv_point.x,
      y: lv_point.y,
      w: 0,
      h: 0,
      label: this.iv_labelInput.trim() || DEFAULT_LABEL,
    };
    this.im_notifyChange();
  }

  /**
   * @param p_event 캔버스 마우스 무브 이벤트
   * @description 드로잉 중 임시 박스 갱신 또는 선택 박스 이동
   */
  public im_handleMouseMove(p_event: React.MouseEvent<HTMLCanvasElement>) {
    const lv_dragState = this.iv_dragState;
    if (lv_dragState.mode === "idle") return;

    const lv_point = this.im_getImagePointFromMouse(p_event);
    if (!lv_point) return;

    if (lv_dragState.mode === "drawing") {
      const lv_x = Math.min(lv_dragState.startX, lv_point.x);
      const lv_y = Math.min(lv_dragState.startY, lv_point.y);
      const lv_w = Math.abs(lv_point.x - lv_dragState.startX);
      const lv_h = Math.abs(lv_point.y - lv_dragState.startY);

      this.iv_draftBox = {
        id: "draft",
        x: lv_x,
        y: lv_y,
        w: lv_w,
        h: lv_h,
        label: this.iv_labelInput.trim() || DEFAULT_LABEL,
      };
      this.im_notifyChange();
      return;
    }

    if (lv_dragState.mode === "moving") {
      this.im_updateCurrentBoxes((p_prevBoxes) =>
        p_prevBoxes.map((p_box) => {
          if (p_box.id !== lv_dragState.boxId) return p_box;

          return {
            ...p_box,
            x: gf_clamp(
              lv_point.x - lv_dragState.offsetX,
              0,
              Math.max(0, this.iv_naturalSize.width - p_box.w)
            ),
            y: gf_clamp(
              lv_point.y - lv_dragState.offsetY,
              0,
              Math.max(0, this.iv_naturalSize.height - p_box.h)
            ),
          };
        })
      );
      this.im_notifyChange();
    }
  }

  /**
   * @param p_event 캔버스 마우스 업 이벤트
   * @description 드로잉 종료 후 최소 크기 이상이면 박스를 확정
   */
  public im_handleMouseUp(p_event: React.MouseEvent<HTMLCanvasElement>) {
    const lv_dragState = this.iv_dragState;
    if (lv_dragState.mode === "idle") return;

    const lv_point = this.im_getImagePointFromMouse(p_event);

    if (lv_dragState.mode === "drawing" && lv_point) {
      const lv_x = Math.min(lv_dragState.startX, lv_point.x);
      const lv_y = Math.min(lv_dragState.startY, lv_point.y);
      const lv_w = Math.abs(lv_point.x - lv_dragState.startX);
      const lv_h = Math.abs(lv_point.y - lv_dragState.startY);

      if (lv_w >= MIN_BOX_SIZE && lv_h >= MIN_BOX_SIZE && this.pt_currentImage) {
        const lv_nextBoxId = `box_${this.iv_boxSequence}`;
        this.iv_boxSequence += 1;

        const lv_nextBox: BoundingBox = {
          id: lv_nextBoxId,
          x: lv_x,
          y: lv_y,
          w: lv_w,
          h: lv_h,
          label: this.iv_labelInput.trim() || DEFAULT_LABEL,
        };

        this.im_updateCurrentBoxes((p_prevBoxes) => [...p_prevBoxes, lv_nextBox]);
        this.iv_selectedBoxId = lv_nextBoxId;
      }
    }

    this.iv_dragState = { mode: "idle" };
    this.iv_draftBox = null;
    this.im_notifyChange();
  }

  /**
   * @param p_event 캔버스 마우스 리브 이벤트
   * @description 포인터 이탈 시 드래그 상태를 종료
   */
  public im_handleMouseLeave(p_event: React.MouseEvent<HTMLCanvasElement>) {
    this.im_handleMouseUp(p_event);
    this.iv_dragState = { mode: "idle" };
  }

  /**
   * @param p_event 캔버스 휠 이벤트
   * @description 마우스 휠로 확대/축소를 제어
   */
  public im_handleCanvasWheel(p_event: React.WheelEvent<HTMLCanvasElement>) {
    if (!this.iv_loadedImage) return;

    p_event.preventDefault();
    if (p_event.deltaY < 0) {
      this.im_zoomIn();
      return;
    }

    this.im_zoomOut();
  }

  /**
   * @description 현재 선택된 박스를 삭제
   */
  public im_deleteSelectedBox() {
    if (!this.iv_selectedBoxId) return;

    const lv_selectedBoxId = this.iv_selectedBoxId;
    this.im_updateCurrentBoxes((p_prevBoxes) =>
      p_prevBoxes.filter((p_box) => p_box.id !== lv_selectedBoxId)
    );
    this.iv_selectedBoxId = null;
    this.im_notifyChange();
  }

  /**
   * @description 현재 이미지의 모든 박스를 삭제
   */
  public im_clearCurrentBoxes() {
    if (this.pt_currentBoxes.length === 0) return;

    this.im_updateCurrentBoxes(() => []);
    this.iv_selectedBoxId = null;
    this.im_notifyChange();
  }

  /**
   * @description 현재 이미지/박스 상태를 캔버스에 그린다.
   */
  public im_drawScene() {
    const lv_canvasElement = this.iv_canvasElement;
    if (!lv_canvasElement) return;

    const lv_canvasSize = this.pt_canvasSize;

    if (lv_canvasElement.width !== lv_canvasSize.width) {
      lv_canvasElement.width = lv_canvasSize.width;
    }
    if (lv_canvasElement.height !== lv_canvasSize.height) {
      lv_canvasElement.height = lv_canvasSize.height;
    }

    const lv_ctx = lv_canvasElement.getContext("2d");
    if (!lv_ctx) return;

    lv_ctx.clearRect(0, 0, lv_canvasElement.width, lv_canvasElement.height);

    if (!this.iv_loadedImage) {
      lv_ctx.fillStyle = "#1f232b";
      lv_ctx.fillRect(0, 0, lv_canvasElement.width, lv_canvasElement.height);
      lv_ctx.fillStyle = "#9ca8ba";
      lv_ctx.font = "16px Arial";
      lv_ctx.textAlign = "center";
      lv_ctx.textBaseline = "middle";
      lv_ctx.fillText(
        "이미지를 선택하면 캔버스가 활성화됩니다.",
        lv_canvasElement.width / 2,
        lv_canvasElement.height / 2
      );
      return;
    }

    lv_ctx.drawImage(this.iv_loadedImage, 0, 0, lv_canvasElement.width, lv_canvasElement.height);

    this.pt_currentBoxes.forEach((p_box) => {
      const lv_x = p_box.x * lv_canvasSize.scale;
      const lv_y = p_box.y * lv_canvasSize.scale;
      const lv_w = p_box.w * lv_canvasSize.scale;
      const lv_h = p_box.h * lv_canvasSize.scale;
      const lv_isSelected = p_box.id === this.iv_selectedBoxId;

      lv_ctx.lineWidth = lv_isSelected ? 2.5 : 2;
      lv_ctx.strokeStyle = lv_isSelected ? "#ff9800" : "#6aa4ff";
      lv_ctx.fillStyle = lv_isSelected ? "rgba(255, 152, 0, 0.18)" : "rgba(106, 164, 255, 0.16)";
      lv_ctx.strokeRect(lv_x, lv_y, lv_w, lv_h);
      lv_ctx.fillRect(lv_x, lv_y, lv_w, lv_h);

      const lv_labelText = `${p_box.label} (${Math.round(p_box.w)}x${Math.round(p_box.h)})`;
      lv_ctx.font = "12px Arial";
      const lv_labelWidth = lv_ctx.measureText(lv_labelText).width;
      const lv_labelHeight = 18;
      const lv_labelY = Math.max(0, lv_y - lv_labelHeight);

      lv_ctx.fillStyle = lv_isSelected ? "rgba(255, 152, 0, 0.9)" : "rgba(33, 82, 177, 0.86)";
      lv_ctx.fillRect(lv_x, lv_labelY, lv_labelWidth + 12, lv_labelHeight);
      lv_ctx.fillStyle = "#ffffff";
      lv_ctx.textBaseline = "middle";
      lv_ctx.fillText(lv_labelText, lv_x + 6, lv_labelY + lv_labelHeight / 2);
    });

    if (this.iv_draftBox) {
      const lv_x = this.iv_draftBox.x * lv_canvasSize.scale;
      const lv_y = this.iv_draftBox.y * lv_canvasSize.scale;
      const lv_w = this.iv_draftBox.w * lv_canvasSize.scale;
      const lv_h = this.iv_draftBox.h * lv_canvasSize.scale;

      lv_ctx.setLineDash([7, 5]);
      lv_ctx.lineWidth = 2;
      lv_ctx.strokeStyle = "#f59e0b";
      lv_ctx.strokeRect(lv_x, lv_y, lv_w, lv_h);
      lv_ctx.setLineDash([]);
    }
  }

  /**
   * @description 컴포넌트 종료 시 참조/드래그 상태 정리
   */
  public im_dispose() {
    this.iv_imageLoadSequence += 1;
    this.iv_canvasElement = null;
    this.iv_loadedImage = null;
    this.iv_dragState = { mode: "idle" };
    this.iv_draftBox = null;
  }
}

export default function BoundingBoxWorkspace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lv_Obj] = useState(() => new BoundingBoxWorkspaceData());
  lv_Obj.im_Prepare_Hooks();

  lv_Obj.im_Mounted(() => {
    void lv_Obj.im_loadImageList();
  });

  lv_Obj.im_Mounted_byData(() => {
    lv_Obj.im_bindCanvasElement(canvasRef.current);
    lv_Obj.im_drawScene();
  }, [lv_Obj.pt_drawToken]);

  lv_Obj.im_UnMounted(() => {
    lv_Obj.im_dispose();
  });

  const lv_images = lv_Obj.pt_images;
  const lv_currentImage = lv_Obj.pt_currentImage;
  const lv_currentBoxes = lv_Obj.pt_currentBoxes;
  const lv_selectedBox = lv_Obj.pt_selectedBox;
  const lv_selectedBoxNormalized = lv_Obj.pt_selectedBoxNormalized;
  const lv_naturalSize = lv_Obj.pt_naturalSize;

  return (
    <section className="bbox-workspace">
      <header className="bbox-workspace__header">
        <div className="bbox-workspace__title-wrap">
          <h2 className="bbox-workspace__title">Bounding Box Workspace</h2>
          <p className="bbox-workspace__status">{lv_Obj.pt_statusMessage}</p>
        </div>
        <button type="button" className="bbox-workspace__refresh" onClick={() => void lv_Obj.im_loadImageList()}>
          이미지 목록 새로고침
        </button>
      </header>

      <div className="bbox-workspace__toolbar">
        <div className="bbox-workspace__pager">
          <button
            type="button"
            disabled={lv_images.length === 0 || lv_Obj.pt_currentIndex <= 0}
            onClick={() => lv_Obj.im_movePrevImage()}
          >
            이전
          </button>
          <span>{lv_images.length === 0 ? "0 / 0" : `${lv_Obj.pt_currentIndex + 1} / ${lv_images.length}`}</span>
          <button
            type="button"
            disabled={lv_images.length === 0 || lv_Obj.pt_currentIndex >= lv_images.length - 1}
            onClick={() => lv_Obj.im_moveNextImage()}
          >
            다음
          </button>
        </div>

        <div className="bbox-workspace__zoom">
          <button type="button" disabled={lv_images.length === 0} onClick={() => lv_Obj.im_zoomOut()}>
            -
          </button>
          <span>{lv_Obj.pt_zoomPercent}%</span>
          <button type="button" disabled={lv_images.length === 0} onClick={() => lv_Obj.im_zoomIn()}>
            +
          </button>
          <button type="button" disabled={lv_images.length === 0} onClick={() => lv_Obj.im_resetZoom()}>
            100%
          </button>
        </div>

        <label className="bbox-workspace__label-input">
          Label
          <input
            type="text"
            value={lv_Obj.pt_labelInput}
            onChange={(p_event) => lv_Obj.im_setLabelInput(p_event.currentTarget.value)}
            placeholder="object"
            maxLength={40}
          />
        </label>

        <button
          type="button"
          className="bbox-workspace__danger"
          disabled={!lv_Obj.pt_selectedBoxId}
          onClick={() => lv_Obj.im_deleteSelectedBox()}
        >
          선택 박스 삭제
        </button>

        <button
          type="button"
          disabled={lv_currentBoxes.length === 0}
          onClick={() => lv_Obj.im_clearCurrentBoxes()}
        >
          현재 이미지 박스 전체 삭제
        </button>
      </div>

      <div className="bbox-workspace__canvas-wrap">
        <canvas
          ref={canvasRef}
          className="bbox-workspace__canvas"
          onMouseDown={(p_event) => lv_Obj.im_handleMouseDown(p_event)}
          onMouseMove={(p_event) => lv_Obj.im_handleMouseMove(p_event)}
          onMouseUp={(p_event) => lv_Obj.im_handleMouseUp(p_event)}
          onMouseLeave={(p_event) => lv_Obj.im_handleMouseLeave(p_event)}
          onWheel={(p_event) => lv_Obj.im_handleCanvasWheel(p_event)}
        />
        {lv_Obj.pt_isLoadingImage && <div className="bbox-workspace__loading">이미지 로딩 중...</div>}
      </div>

      <div className="bbox-workspace__meta-grid">
        <p>
          <strong>현재 경로:</strong> {lv_currentImage?.relativePath || "-"}
        </p>
        <p>
          <strong>이미지 크기:</strong>{" "}
          {lv_naturalSize.width > 0 && lv_naturalSize.height > 0
            ? `${lv_naturalSize.width} x ${lv_naturalSize.height}`
            : "-"}
        </p>
        <p>
          <strong>박스 수:</strong> 현재 {lv_currentBoxes.length}개 / 전체 {lv_Obj.pt_totalBoxCount}개
        </p>
        <p>
          <strong>작업 가이드:</strong> 드래그로 박스 생성, 박스 내부 드래그로 이동
        </p>
        {lv_selectedBox && (
          <p className="bbox-workspace__meta-highlight">
            <strong>선택 박스(px):</strong> x={lv_selectedBox.x.toFixed(1)} y={lv_selectedBox.y.toFixed(1)} w=
            {lv_selectedBox.w.toFixed(1)} h={lv_selectedBox.h.toFixed(1)}
          </p>
        )}
        {lv_selectedBoxNormalized && (
          <p className="bbox-workspace__meta-highlight">
            <strong>선택 박스(YOLO):</strong> cx={lv_selectedBoxNormalized.cx.toFixed(5)} cy=
            {lv_selectedBoxNormalized.cy.toFixed(5)} w={lv_selectedBoxNormalized.w.toFixed(5)} h=
            {lv_selectedBoxNormalized.h.toFixed(5)}
          </p>
        )}
      </div>
    </section>
  );
}
