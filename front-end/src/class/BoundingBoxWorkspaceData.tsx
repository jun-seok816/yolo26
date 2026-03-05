import type React from "react";

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

export type BoundingBox = {
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

type ExportSplit = "train" | "valid" | "test";

type ExportTarget = {
  image: RouterImageItem;
  split: ExportSplit;
  exportFileName: string;
};

const DEFAULT_LABEL_CATEGORIES = ["fish", "other"];
const DEFAULT_LABEL = DEFAULT_LABEL_CATEGORIES[0];
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

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  }
}

export class BoundingBoxWorkspaceData {
  private iv_images: RouterImageItem[] = [];
  private iv_currentIndex = 0;
  private iv_boxesByImage: Record<string, BoundingBox[]> = {};
  private iv_selectedBoxId: string | null = null;
  private iv_draftBox: BoundingBox | null = null;
  private iv_isLoadingImage = false;
  private iv_statusMessage = "라우터 이미지 목록을 불러오는 중입니다.";
  private iv_labelCategories: string[] = [...DEFAULT_LABEL_CATEGORIES];
  private iv_labelInput: string = DEFAULT_LABEL;
  private iv_categoryDraftName = "";
  private iv_categoryStatusMessage = "";
  private iv_naturalSize: ImageSize = { width: 0, height: 0 };

  private iv_canvasElement: HTMLCanvasElement | null = null;
  private iv_loadedImage: HTMLImageElement | null = null;
  private iv_dragState: DragState = { mode: "idle" };
  private iv_boxSequence = 1;
  private iv_imageLoadSequence = 0;
  private iv_zoomScale = 1;
  private iv_isExporting = false;
  private iv_onChange: () => void;

  constructor(p_onChange: () => void = () => {}) {
    this.iv_onChange = p_onChange;
  }

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
   * @description 선택 가능한 라벨 카테고리 목록 반환
   */
  public get pt_labelCategories(): readonly string[] {
    return this.iv_labelCategories;
  }

  /**
   * @description 신규 카테고리 입력값 반환
   */
  public get pt_categoryDraftName(): string {
    return this.iv_categoryDraftName;
  }

  /**
   * @description 카테고리 편집 결과 메시지 반환
   */
  public get pt_categoryStatusMessage(): string {
    return this.iv_categoryStatusMessage;
  }

  /**
   * @description 현재 선택 카테고리 사용 박스 수 반환
   */
  public get pt_selectedCategoryUsageCount(): number {
    return this.im_getCategoryUsageCount(this.iv_labelInput);
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
   * @description 현재 줌 퍼센트(%) 반환
   */
  public get pt_zoomPercent(): number {
    return Math.round(this.iv_zoomScale * 100);
  }

  /**
   * @description YOLO26 export 진행 상태 반환
   */
  public get pt_isExporting(): boolean {
    return this.iv_isExporting;
  }

  /**
   * @description 내부 상태 변경 후 화면 렌더를 트리거
   */
  private im_notifyChange() {
    this.iv_onChange();
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
    if (!this.iv_labelCategories.includes(p_label)) return;
    this.iv_labelInput = p_label;
    this.iv_categoryStatusMessage = "";
    this.im_notifyChange();
  }

  /**
   * @param p_name 신규 카테고리 입력 문자열
   * @description 카테고리 입력 필드 값을 갱신
   */
  public im_setCategoryDraftName(p_name: string) {
    this.iv_categoryDraftName = p_name;
    this.im_notifyChange();
  }

  /**
   * @description 신규 카테고리를 목록에 추가
   */
  public im_addCategory() {
    const lv_categoryName = this.iv_categoryDraftName.trim();
    if (!lv_categoryName) {
      this.iv_categoryStatusMessage = "카테고리 이름을 입력해주세요.";
      this.im_notifyChange();
      return;
    }

    const lv_exists = this.iv_labelCategories.some(
      (p_item) => p_item.toLowerCase() === lv_categoryName.toLowerCase()
    );
    if (lv_exists) {
      this.iv_categoryStatusMessage = "이미 존재하는 카테고리입니다.";
      this.im_notifyChange();
      return;
    }

    this.iv_labelCategories = [...this.iv_labelCategories, lv_categoryName];
    this.iv_labelInput = lv_categoryName;
    this.iv_categoryDraftName = "";
    this.iv_categoryStatusMessage = `'${lv_categoryName}' 카테고리를 추가했습니다.`;
    this.im_notifyChange();
  }

  /**
   * @description 현재 선택된 카테고리를 목록에서 삭제
   */
  public im_deleteSelectedCategory() {
    if (this.iv_labelCategories.length <= 1) {
      this.iv_categoryStatusMessage = "카테고리는 최소 1개 이상 유지해야 합니다.";
      this.im_notifyChange();
      return;
    }

    const lv_targetCategory = this.iv_labelInput;
    const lv_usageCount = this.im_getCategoryUsageCount(lv_targetCategory);
    if (lv_usageCount > 0) {
      this.iv_categoryStatusMessage = `'${lv_targetCategory}' 라벨 박스 ${lv_usageCount}개가 있어 삭제할 수 없습니다.`;
      this.im_notifyChange();
      return;
    }

    this.iv_labelCategories = this.iv_labelCategories.filter((p_item) => p_item !== lv_targetCategory);
    this.iv_labelInput = this.iv_labelCategories[0] || DEFAULT_LABEL;
    this.iv_categoryStatusMessage = `'${lv_targetCategory}' 카테고리를 삭제했습니다.`;
    this.im_notifyChange();
  }

  /**
   * @param p_categoryName 카테고리 이름
   * @returns 카테고리를 사용 중인 박스 개수
   * @description 전체 이미지 기준 카테고리 사용량을 계산
   */
  private im_getCategoryUsageCount(p_categoryName: string): number {
    return Object.values(this.iv_boxesByImage).reduce((p_sum, p_boxes) => {
      return p_sum + p_boxes.filter((p_box) => p_box.label === p_categoryName).length;
    }, 0);
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
   * @param p_boxId 선택할 박스 ID (null이면 선택 해제)
   * @description 외부 리스트뷰 클릭 기반으로 박스 선택 상태를 변경
   */
  public im_selectBoxById(p_boxId: string | null) {
    if (p_boxId === null) {
      if (this.iv_selectedBoxId === null) return;
      this.iv_selectedBoxId = null;
      this.im_notifyChange();
      return;
    }

    const lv_exists = this.pt_currentBoxes.some((p_box) => p_box.id === p_boxId);
    if (!lv_exists) return;
    if (this.iv_selectedBoxId === p_boxId) return;

    this.iv_selectedBoxId = p_boxId;
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
      label: this.iv_labelInput,
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
        label: this.iv_labelInput,
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
          label: this.iv_labelInput,
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
   * @description 현재 라벨링 데이터를 YOLO26 포맷 디렉터리로 export
   */
  public async im_exportYolo26Dataset() {
    if (this.iv_isExporting) return;

    if (this.iv_images.length === 0) {
      this.iv_statusMessage = "내보낼 이미지가 없습니다. 먼저 /images/list에서 이미지를 로드해주세요.";
      this.im_notifyChange();
      return;
    }

    const lv_showDirectoryPicker = window.showDirectoryPicker;
    if (typeof lv_showDirectoryPicker !== "function") {
      this.iv_statusMessage = "현재 브라우저는 폴더 export를 지원하지 않습니다. Chrome/Edge에서 시도해주세요.";
      this.im_notifyChange();
      return;
    }

    this.iv_isExporting = true;
    this.iv_statusMessage = "YOLO26 export 준비 중입니다.";
    this.im_notifyChange();

    try {
      const lv_baseDirectory = await lv_showDirectoryPicker();
      const lv_exportFolderName = `yolo26_export_${this.im_getExportTimestampToken()}`;
      const lv_rootDirectory = await lv_baseDirectory.getDirectoryHandle(lv_exportFolderName, {
        create: true,
      });
      const lv_splitDirectories = await this.im_createSplitDirectoryHandles(lv_rootDirectory);
      const lv_exportTargets = this.im_buildExportTargets();
      const lv_splitCounts: Record<ExportSplit, number> = {
        train: 0,
        valid: 0,
        test: 0,
      };

      for (let lv_i = 0; lv_i < lv_exportTargets.length; lv_i += 1) {
        const lv_target = lv_exportTargets[lv_i];
        const lv_imageBlob = await this.im_fetchImageBlob(lv_target.image.url);
        const lv_imageSize = await this.im_getImageSizeFromBlob(lv_imageBlob);
        const lv_splitDirectory = lv_splitDirectories[lv_target.split];
        const lv_boxes = this.iv_boxesByImage[lv_target.image.id] || [];
        const lv_labelText = this.im_buildYoloLabelText(lv_boxes, lv_imageSize);
        const lv_labelFileName = `${this.im_removeFileExtension(lv_target.exportFileName)}.txt`;

        this.iv_statusMessage = `YOLO26 export 중... ${lv_i + 1}/${lv_exportTargets.length} (${lv_target.image.relativePath})`;
        this.im_notifyChange();

        await this.im_writeFile(lv_splitDirectory.images, lv_target.exportFileName, lv_imageBlob);
        await this.im_writeFile(lv_splitDirectory.labels, lv_labelFileName, lv_labelText);
        lv_splitCounts[lv_target.split] += 1;
      }

      await this.im_writeFile(lv_rootDirectory, "data.yaml", this.im_buildYoloDataYaml());
      await this.im_writeFile(
        lv_rootDirectory,
        "README.dataset.txt",
        this.im_buildExportReadme(lv_exportTargets.length, lv_splitCounts)
      );

      this.iv_statusMessage = `YOLO26 export 완료: ${lv_exportFolderName} (${lv_exportTargets.length}장)`;
    } catch (p_error) {
      if (p_error instanceof DOMException && p_error.name === "AbortError") {
        this.iv_statusMessage = "YOLO26 export를 취소했습니다.";
      } else {
        console.error("[BoundingBoxWorkspace] YOLO26 export failed:", p_error);
        this.iv_statusMessage = "YOLO26 export에 실패했습니다.";
      }
    } finally {
      this.iv_isExporting = false;
      this.im_notifyChange();
    }
  }

  /**
   * @description export 대상 이미지를 split 규칙에 맞춰 계산
   */
  private im_buildExportTargets(): ExportTarget[] {
    const lv_targets: ExportTarget[] = [];
    const lv_unknownImages: RouterImageItem[] = [];

    this.iv_images.forEach((p_image) => {
      const lv_split = this.im_detectKnownSplit(p_image.relativePath);
      if (!lv_split) {
        lv_unknownImages.push(p_image);
        return;
      }

      lv_targets.push({
        image: p_image,
        split: lv_split,
        exportFileName: this.im_buildExportFileName(p_image.relativePath),
      });
    });

    lv_unknownImages
      .slice()
      .sort((p_a, p_b) => p_a.relativePath.localeCompare(p_b.relativePath))
      .forEach((p_image, p_index) => {
        const lv_splitIndex = p_index % 10;
        const lv_split: ExportSplit = lv_splitIndex < 8 ? "train" : lv_splitIndex === 8 ? "valid" : "test";

        lv_targets.push({
          image: p_image,
          split: lv_split,
          exportFileName: this.im_buildExportFileName(p_image.relativePath),
        });
      });

    return lv_targets;
  }

  /**
   * @param p_relativePath 이미지 상대 경로
   * @returns 경로 기반 split 추정 결과
   */
  private im_detectKnownSplit(p_relativePath: string): ExportSplit | null {
    const lv_normalized = p_relativePath.replace(/\\/g, "/").toLowerCase();
    if (/(^|\/)train\/images\//.test(lv_normalized)) return "train";
    if (/(^|\/)(valid|val)\/images\//.test(lv_normalized)) return "valid";
    if (/(^|\/)test\/images\//.test(lv_normalized)) return "test";
    return null;
  }

  /**
   * @param p_relativePath 이미지 상대 경로
   * @returns export 파일명 (경로 충돌 회피용)
   */
  private im_buildExportFileName(p_relativePath: string): string {
    const lv_normalized = p_relativePath.replace(/\\/g, "/").replace(/^\/+/, "").trim();
    const lv_fileName = lv_normalized.replace(/\//g, "__");
    const lv_sanitized = lv_fileName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
    return lv_sanitized || "image.jpg";
  }

  /**
   * @param p_fileName 파일명
   * @returns 확장자를 제거한 파일명
   */
  private im_removeFileExtension(p_fileName: string): string {
    const lv_dotIndex = p_fileName.lastIndexOf(".");
    if (lv_dotIndex <= 0) return p_fileName;
    return p_fileName.slice(0, lv_dotIndex);
  }

  /**
   * @param p_rootDirectory export 루트 폴더 핸들
   * @returns split별 images/labels 디렉터리 핸들 맵
   */
  private async im_createSplitDirectoryHandles(p_rootDirectory: FileSystemDirectoryHandle) {
    const lv_trainDirectory = await p_rootDirectory.getDirectoryHandle("train", { create: true });
    const lv_validDirectory = await p_rootDirectory.getDirectoryHandle("valid", { create: true });
    const lv_testDirectory = await p_rootDirectory.getDirectoryHandle("test", { create: true });

    const lv_trainImages = await lv_trainDirectory.getDirectoryHandle("images", { create: true });
    const lv_trainLabels = await lv_trainDirectory.getDirectoryHandle("labels", { create: true });
    const lv_validImages = await lv_validDirectory.getDirectoryHandle("images", { create: true });
    const lv_validLabels = await lv_validDirectory.getDirectoryHandle("labels", { create: true });
    const lv_testImages = await lv_testDirectory.getDirectoryHandle("images", { create: true });
    const lv_testLabels = await lv_testDirectory.getDirectoryHandle("labels", { create: true });

    return {
      train: { images: lv_trainImages, labels: lv_trainLabels },
      valid: { images: lv_validImages, labels: lv_validLabels },
      test: { images: lv_testImages, labels: lv_testLabels },
    } as const;
  }

  /**
   * @param p_directory 파일을 저장할 디렉터리 핸들
   * @param p_fileName 생성할 파일명
   * @param p_content 파일 본문
   * @description File System Access API로 파일을 생성/갱신
   */
  private async im_writeFile(
    p_directory: FileSystemDirectoryHandle,
    p_fileName: string,
    p_content: string | Blob
  ) {
    const lv_fileHandle = await p_directory.getFileHandle(p_fileName, { create: true });
    const lv_writable = await lv_fileHandle.createWritable();
    await lv_writable.write(p_content);
    await lv_writable.close();
  }

  /**
   * @param p_imageUrl 이미지 URL
   * @returns 이미지 Blob 데이터
   */
  private async im_fetchImageBlob(p_imageUrl: string): Promise<Blob> {
    const lv_response = await fetch(p_imageUrl);
    if (!lv_response.ok) {
      throw new Error(`image download failed: ${p_imageUrl} (${lv_response.status})`);
    }

    return lv_response.blob();
  }

  /**
   * @param p_blob 이미지 Blob
   * @returns 이미지 원본 크기(px)
   */
  private async im_getImageSizeFromBlob(p_blob: Blob): Promise<ImageSize> {
    return new Promise((p_resolve, p_reject) => {
      const lv_objectUrl = URL.createObjectURL(p_blob);
      const lv_image = new Image();

      lv_image.onload = () => {
        URL.revokeObjectURL(lv_objectUrl);
        if (lv_image.naturalWidth <= 0 || lv_image.naturalHeight <= 0) {
          p_reject(new Error("invalid image size"));
          return;
        }

        p_resolve({
          width: lv_image.naturalWidth,
          height: lv_image.naturalHeight,
        });
      };

      lv_image.onerror = () => {
        URL.revokeObjectURL(lv_objectUrl);
        p_reject(new Error("image size read failed"));
      };

      lv_image.src = lv_objectUrl;
    });
  }

  /**
   * @param p_boxes 이미지에 매핑된 박스 목록
   * @param p_size 원본 이미지 크기
   * @returns YOLO txt 파일 본문
   */
  private im_buildYoloLabelText(p_boxes: BoundingBox[], p_size: ImageSize): string {
    if (p_boxes.length === 0 || p_size.width <= 0 || p_size.height <= 0) {
      return "";
    }

    const lv_lines = p_boxes
      .map((p_box) => {
        const lv_classId = this.iv_labelCategories.findIndex((p_category) => p_category === p_box.label);
        if (lv_classId < 0) return null;

        const lv_cx = gf_clamp((p_box.x + p_box.w / 2) / p_size.width, 0, 1);
        const lv_cy = gf_clamp((p_box.y + p_box.h / 2) / p_size.height, 0, 1);
        const lv_w = gf_clamp(p_box.w / p_size.width, 0, 1);
        const lv_h = gf_clamp(p_box.h / p_size.height, 0, 1);

        return `${lv_classId} ${this.im_formatYoloFloat(lv_cx)} ${this.im_formatYoloFloat(
          lv_cy
        )} ${this.im_formatYoloFloat(lv_w)} ${this.im_formatYoloFloat(lv_h)}`;
      })
      .filter((p_line): p_line is string => p_line !== null);

    return lv_lines.join("\n");
  }

  /**
   * @param p_value 수치값
   * @returns YOLO txt 저장용 소수 문자열
   */
  private im_formatYoloFloat(p_value: number): string {
    const lv_text = p_value.toFixed(10).replace(/0+$/g, "").replace(/\.$/g, "");
    return lv_text || "0";
  }

  /**
   * @returns YOLO 데이터셋 설정 파일(data.yaml) 본문
   */
  private im_buildYoloDataYaml(): string {
    const lv_names = this.iv_labelCategories
      .map((p_category) => `'${p_category.replace(/'/g, "''")}'`)
      .join(", ");

    return [
      "train: ../train/images",
      "val: ../valid/images",
      "test: ../test/images",
      "",
      `nc: ${this.iv_labelCategories.length}`,
      `names: [${lv_names}]`,
      "",
    ].join("\n");
  }

  /**
   * @param p_totalImages export된 이미지 총 개수
   * @param p_splitCounts split별 이미지 개수
   * @returns README.dataset.txt 본문
   */
  private im_buildExportReadme(p_totalImages: number, p_splitCounts: Record<ExportSplit, number>): string {
    const lv_exportedAt = new Date().toISOString();

    return [
      `# yolo26-export > ${lv_exportedAt}`,
      "",
      "Exported by YOLO26 labeling workspace",
      "",
      `Total images: ${p_totalImages}`,
      `train: ${p_splitCounts.train}`,
      `valid: ${p_splitCounts.valid}`,
      `test: ${p_splitCounts.test}`,
      `total boxes: ${this.pt_totalBoxCount}`,
      "",
      `categories(${this.iv_labelCategories.length}): ${this.iv_labelCategories.join(", ")}`,
      "",
    ].join("\n");
  }

  /**
   * @returns export 폴더명 생성용 타임스탬프 문자열
   */
  private im_getExportTimestampToken(): string {
    const lv_now = new Date();
    const lv_pad2 = (p_value: number) => p_value.toString().padStart(2, "0");

    return [
      lv_now.getFullYear(),
      lv_pad2(lv_now.getMonth() + 1),
      lv_pad2(lv_now.getDate()),
      "_",
      lv_pad2(lv_now.getHours()),
      lv_pad2(lv_now.getMinutes()),
      lv_pad2(lv_now.getSeconds()),
    ].join("");
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
