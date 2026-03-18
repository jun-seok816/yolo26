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

export type BoundingBoxWorkspaceImageItem = RouterImageItem;

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

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

type DragState =
  | { mode: "idle" }
  | { mode: "drawing"; startX: number; startY: number }
  | { mode: "moving"; boxId: string; offsetX: number; offsetY: number }
  | { mode: "resizing"; boxId: string; handle: ResizeHandle; initialBox: BoundingBox };

type ExportSplit = "train" | "valid" | "test";

type ExportTarget = {
  image: RouterImageItem;
  split: ExportSplit;
  exportFileName: string;
};

type DatasetFileKind = "images" | "labels";

type ParsedDatasetPath = {
  split: ExportSplit;
  kind: DatasetFileKind;
  relativePath: string;
};

type ImportImageCandidate = {
  file: File;
  split: ExportSplit;
  relativePathInSplit: string;
};

const DEFAULT_LABEL_CATEGORIES = ["fish", "other"];
const DEFAULT_LABEL = DEFAULT_LABEL_CATEGORIES[0];
const MIN_BOX_SIZE = 4;
const MAX_CANVAS_WIDTH = 860;
const MAX_CANVAS_HEIGHT = 640;
const MIN_ZOOM_SCALE = 0.2;
const MAX_ZOOM_SCALE = 5;
const ZOOM_STEP = 0.2;
const RESIZE_HANDLE_SIZE = 10;
const RESIZE_HANDLE_HIT_SIZE = 18;
const DEFAULT_SPLIT_TRAIN_PERCENT = 70;
const DEFAULT_SPLIT_VALID_PERCENT = 20;
const IMPORT_IMAGE_FILE_EXTENSION_PATTERN = /\.(png|jpe?g|webp|bmp|gif)$/i;

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
  private iv_statusMessage = "Pass an image to begin labeling.";
  private iv_labelCategories: string[] = [...DEFAULT_LABEL_CATEGORIES];
  private iv_labelInput: string = DEFAULT_LABEL;
  private iv_categoryDraftName = "";
  private iv_categoryStatusMessage = "";
  private iv_naturalSize: ImageSize = { width: 0, height: 0 };

  private iv_canvasElement: HTMLCanvasElement | null = null;
  private iv_loadedImage: HTMLImageElement | null = null;
  private iv_dragState: DragState = { mode: "idle" };
  private iv_hoverPoint: { x: number; y: number } | null = null;
  private iv_boxSequence = 1;
  private iv_imageLoadSequence = 0;
  private iv_zoomScale = 1;
  private iv_splitTrainPercent = DEFAULT_SPLIT_TRAIN_PERCENT;
  private iv_splitValidBoundaryPercent = DEFAULT_SPLIT_TRAIN_PERCENT + DEFAULT_SPLIT_VALID_PERCENT;
  private iv_localImageObjectUrls: string[] = [];
  private iv_isImporting = false;
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
   * @description Dataset import progress state
   */
  public get pt_isImporting(): boolean {
    return this.iv_isImporting;
  }

  /**
   * @description Dataset export progress state
   */
  public get pt_isExporting(): boolean {
    return this.iv_isExporting;
  }

  /**
   * @description export용 train 비율(%) 반환
   */
  public get pt_splitTrainPercent(): number {
    return this.iv_splitTrainPercent;
  }

  /**
   * @description export용 valid 경계값(%) 반환 (train + valid)
   */
  public get pt_splitValidBoundaryPercent(): number {
    return this.iv_splitValidBoundaryPercent;
  }

  /**
   * @description export용 valid 비율(%) 반환
   */
  public get pt_splitValidPercent(): number {
    return this.iv_splitValidBoundaryPercent - this.iv_splitTrainPercent;
  }

  /**
   * @description export용 test 비율(%) 반환
   */
  public get pt_splitTestPercent(): number {
    return 100 - this.iv_splitValidBoundaryPercent;
  }

  /**
   * @description 현재 로드 이미지 수 기준 split 결과 개수 반환
   */
  public get pt_exportSplitImageCounts(): Record<ExportSplit, number> {
    return this.im_buildSplitCounts(this.iv_images.length);
  }

  /**
   * @description 내부 상태 변경 후 화면 렌더를 트리거
   */
  private im_notifyChange() {
    this.im_syncCanvasCursor();
    this.iv_onChange();
  }

  /**
   * @description import 이미지 object URL 리소스를 정리
   */
  private im_revokeLocalImageObjectUrls() {
    this.iv_localImageObjectUrls.forEach((p_url) => {
      URL.revokeObjectURL(p_url);
    });
    this.iv_localImageObjectUrls = [];
  }

  /**
   * @param p_images 비교할 이미지 목록
   * @returns 현재 워크스페이스와 동일한 이미지 목록인지 여부
   * @description 외부 props 기반 이미지 반영 시 불필요한 재로딩을 방지
   */
  private im_hasSameImageList(p_images: BoundingBoxWorkspaceImageItem[]) {
    if (this.iv_images.length !== p_images.length) return false;

    return this.iv_images.every((p_image, p_index) => {
      const lv_targetImage = p_images[p_index];
      if (!lv_targetImage) return false;

      return (
        p_image.id === lv_targetImage.id &&
        p_image.relativePath === lv_targetImage.relativePath &&
        p_image.url === lv_targetImage.url
      );
    });
  }

  /**
   * @param p_canvasElement 캔버스 DOM 엘리먼트
   * @description 캔버스 참조를 바인딩하고 즉시 렌더
   */
  public im_bindCanvasElement(p_canvasElement: HTMLCanvasElement | null) {
    if (this.iv_canvasElement === p_canvasElement) return;
    this.iv_canvasElement = p_canvasElement;
    this.im_syncCanvasCursor();
    this.im_drawScene();
  }

  /**
   * @param p_images 외부 컴포넌트에서 전달한 이미지 목록
   * @description 라우터 fetch 대신 props 기반 이미지 목록을 워크스페이스에 반영
   */
  public im_setProvidedImages(p_images: BoundingBoxWorkspaceImageItem[]) {
    const lv_nextImages = p_images.filter(
      (p_image) =>
        p_image.id.trim().length > 0 &&
        p_image.relativePath.trim().length > 0 &&
        p_image.url.trim().length > 0
    );
    if (this.im_hasSameImageList(lv_nextImages)) return;

    this.im_revokeLocalImageObjectUrls();

    const lv_prevCurrentImageId = this.pt_currentImage?.id || null;
    const lv_nextBoxesByImage: Record<string, BoundingBox[]> = {};
    lv_nextImages.forEach((p_image) => {
      const lv_existingBoxes = this.iv_boxesByImage[p_image.id];
      if (!lv_existingBoxes) return;
      lv_nextBoxesByImage[p_image.id] = lv_existingBoxes;
    });

    const lv_nextCurrentIndex = lv_prevCurrentImageId
      ? lv_nextImages.findIndex((p_image) => p_image.id === lv_prevCurrentImageId)
      : 0;

    this.iv_images = lv_nextImages;
    this.iv_currentIndex = lv_nextCurrentIndex >= 0 ? lv_nextCurrentIndex : 0;
    this.iv_boxesByImage = lv_nextBoxesByImage;
    this.iv_selectedBoxId = null;
    this.iv_draftBox = null;
    this.iv_dragState = { mode: "idle" };
    this.iv_hoverPoint = null;

    if (lv_nextImages.length === 0) {
      this.iv_loadedImage = null;
      this.iv_naturalSize = { width: 0, height: 0 };
      this.iv_isLoadingImage = false;
      this.iv_statusMessage = "Pass an image to begin labeling.";
      this.im_notifyChange();
      return;
    }

    this.im_startCurrentImageLoading();
  }

  /**
   * @param p_categories 외부에서 전달한 카테고리 목록
   * @param p_boxes 현재 이미지에 적용할 박스 목록
   * @returns 워크스페이스에 반영할 카테고리 목록
   * @description 외부 props 상태를 반영할 때 카테고리/박스 라벨을 함께 정규화
   */
  private im_buildProvidedLabelCategories(p_categories: readonly string[], p_boxes: readonly BoundingBox[]) {
    const lv_categoryMap = new Map<string, string>();
    const lf_pushCategory = (p_name: string) => {
      const lv_name = p_name.trim();
      if (!lv_name) return;

      const lv_key = lv_name.toLowerCase();
      if (lv_categoryMap.has(lv_key)) return;
      lv_categoryMap.set(lv_key, lv_name);
    };

    p_categories.forEach(lf_pushCategory);
    p_boxes.forEach((p_box) => {
      lf_pushCategory(p_box.label);
    });

    const lv_categories = Array.from(lv_categoryMap.values());
    return lv_categories.length > 0 ? lv_categories : [...DEFAULT_LABEL_CATEGORIES];
  }

  /**
   * @param p_boxes 외부에서 전달한 현재 이미지 박스 목록
   * @param p_categories 외부에서 전달한 카테고리 목록
   * @description 단일 이미지 모듈에서 현재 이미지의 라벨링 상태를 동기화
   */
  public im_setProvidedCurrentImageLabelState(p_boxes: BoundingBox[], p_categories: string[] = []) {
    const lv_currentImage = this.pt_currentImage;
    const lv_hasNaturalSize = this.iv_naturalSize.width > 0 && this.iv_naturalSize.height > 0;
    const lv_nextBoxes = p_boxes
      .map((p_box, p_index) => {
        const lv_label = p_box.label.trim();
        if (!lv_label) return null;

        const lv_id = p_box.id.trim() || `provided_box_${p_index + 1}`;
        const lv_x = lv_hasNaturalSize ? gf_clamp(p_box.x, 0, this.iv_naturalSize.width) : Math.max(0, p_box.x);
        const lv_y = lv_hasNaturalSize ? gf_clamp(p_box.y, 0, this.iv_naturalSize.height) : Math.max(0, p_box.y);
        const lv_w = lv_hasNaturalSize
          ? gf_clamp(p_box.w, MIN_BOX_SIZE, Math.max(MIN_BOX_SIZE, this.iv_naturalSize.width - lv_x))
          : Math.max(MIN_BOX_SIZE, p_box.w);
        const lv_h = lv_hasNaturalSize
          ? gf_clamp(p_box.h, MIN_BOX_SIZE, Math.max(MIN_BOX_SIZE, this.iv_naturalSize.height - lv_y))
          : Math.max(MIN_BOX_SIZE, p_box.h);

        return {
          id: lv_id,
          x: lv_x,
          y: lv_y,
          w: lv_w,
          h: lv_h,
          label: lv_label,
        } satisfies BoundingBox;
      })
      .filter((p_box): p_box is BoundingBox => p_box !== null);

    const lv_nextCategories = this.im_buildProvidedLabelCategories(p_categories, lv_nextBoxes);
    this.iv_labelCategories = lv_nextCategories;
    if (!lv_nextCategories.includes(this.iv_labelInput)) {
      this.iv_labelInput = lv_nextCategories[0] || DEFAULT_LABEL;
    }
    this.iv_categoryDraftName = "";
    this.iv_categoryStatusMessage = "";
    this.iv_selectedBoxId = null;
    this.iv_draftBox = null;
    this.iv_dragState = { mode: "idle" };
    this.iv_hoverPoint = null;

    if (lv_currentImage) {
      this.iv_boxesByImage = {
        ...this.iv_boxesByImage,
        [lv_currentImage.id]: lv_nextBoxes,
      };
    }

    const lv_maxBoxSequence = lv_nextBoxes.reduce((p_max, p_box) => {
      const lv_match = p_box.id.match(/(\d+)$/);
      if (!lv_match) return p_max;
      return Math.max(p_max, Number(lv_match[1]));
    }, 0);
    this.iv_boxSequence = Math.max(this.iv_boxSequence, lv_nextBoxes.length + 1, lv_maxBoxSequence + 1);
    this.im_notifyChange();
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
   * @param p_percent train 비율(%)
   * @description export split의 train 비율을 갱신
   */
  public im_setSplitTrainPercent(p_percent: number) {
    const lv_nextTrainPercent = this.im_normalizeSplitPercent(p_percent);
    const lv_nextValidBoundaryPercent = Math.max(lv_nextTrainPercent, this.iv_splitValidBoundaryPercent);

    if (
      lv_nextTrainPercent === this.iv_splitTrainPercent &&
      lv_nextValidBoundaryPercent === this.iv_splitValidBoundaryPercent
    ) {
      return;
    }

    this.iv_splitTrainPercent = lv_nextTrainPercent;
    this.iv_splitValidBoundaryPercent = lv_nextValidBoundaryPercent;
    this.im_notifyChange();
  }

  /**
   * @param p_percent valid 경계값(%)
   * @description export split의 valid 경계(train+valid)를 갱신
   */
  public im_setSplitValidBoundaryPercent(p_percent: number) {
    const lv_nextValidBoundaryPercent = this.im_normalizeSplitPercent(p_percent);
    const lv_nextTrainPercent = Math.min(this.iv_splitTrainPercent, lv_nextValidBoundaryPercent);

    if (
      lv_nextTrainPercent === this.iv_splitTrainPercent &&
      lv_nextValidBoundaryPercent === this.iv_splitValidBoundaryPercent
    ) {
      return;
    }

    this.iv_splitTrainPercent = lv_nextTrainPercent;
    this.iv_splitValidBoundaryPercent = lv_nextValidBoundaryPercent;
    this.im_notifyChange();
  }

  /**
   * @param p_percent percent 입력값
   * @returns 0~100 범위로 보정된 정수 percent
   */
  private im_normalizeSplitPercent(p_percent: number): number {
    if (!Number.isFinite(p_percent)) return 0;
    return gf_clamp(Math.round(p_percent), 0, 100);
  }

  /**
   * @param p_totalImages 이미지 총 개수
   * @returns 현재 split 비율 기준 이미지 개수
   */
  private im_buildSplitCounts(p_totalImages: number): Record<ExportSplit, number> {
    if (p_totalImages <= 0) {
      return { train: 0, valid: 0, test: 0 };
    }

    const lv_ratioMap: Record<ExportSplit, number> = {
      train: this.pt_splitTrainPercent / 100,
      valid: this.pt_splitValidPercent / 100,
      test: this.pt_splitTestPercent / 100,
    };
    const lv_countMap: Record<ExportSplit, number> = {
      train: 0,
      valid: 0,
      test: 0,
    };
    const lv_order: ExportSplit[] = ["train", "valid", "test"];

    const lv_allocations = lv_order.map((p_split, p_index) => {
      const lv_raw = p_totalImages * lv_ratioMap[p_split];
      const lv_base = Math.floor(lv_raw);
      lv_countMap[p_split] = lv_base;

      return {
        split: p_split,
        fraction: lv_raw - lv_base,
        priority: p_index,
      };
    });

    let lv_remain = p_totalImages - (lv_countMap.train + lv_countMap.valid + lv_countMap.test);
    lv_allocations.sort((p_a, p_b) => {
      if (p_b.fraction !== p_a.fraction) return p_b.fraction - p_a.fraction;
      return p_a.priority - p_b.priority;
    });

    let lv_allocationIndex = 0;
    while (lv_remain > 0) {
      const lv_targetSplit = lv_allocations[lv_allocationIndex % lv_allocations.length].split;
      lv_countMap[lv_targetSplit] += 1;
      lv_allocationIndex += 1;
      lv_remain -= 1;
    }

    return lv_countMap;
  }

  /**
   * @param p_input import용 directory input 엘리먼트
   * @description Adds folder-selection attributes for dataset import
   */
  public im_prepareImportDirectoryInput(p_input: HTMLInputElement | null) {
    if (!p_input) return;

    const lv_input = p_input as HTMLInputElement & {
      webkitdirectory?: boolean;
      directory?: boolean;
    };

    lv_input.webkitdirectory = true;
    lv_input.directory = true;
  }

  /**
   * @param p_input directory input 엘리먼트
   * @description Imports a dataset folder from local files
   */
  public async im_importYolo26FromDirectoryInput(p_input: HTMLInputElement) {
    if (this.iv_isImporting || this.iv_isExporting) {
      p_input.value = "";
      return;
    }

    const lv_files = Array.from(p_input.files || []);
    p_input.value = "";
    if (lv_files.length === 0) return;

    this.iv_isImporting = true;
    this.iv_statusMessage = "Preparing dataset import.";
    this.im_notifyChange();
    const lv_nextObjectUrls: string[] = [];

    try {
      const lv_splitCountsFromFolder: Record<ExportSplit, number> = {
        train: 0,
        valid: 0,
        test: 0,
      };
      const lv_imageCandidates: ImportImageCandidate[] = [];
      const lv_labelFileByKey = new Map<string, File>();
      let lv_dataYamlFile: File | null = null;

      for (const p_file of lv_files) {
        const lv_relativePath = this.im_getInputFileRelativePath(p_file);
        if (!lv_dataYamlFile && /(^|\/)data\.ya?ml$/i.test(lv_relativePath)) {
          lv_dataYamlFile = p_file;
        }

        const lv_parsedPath = this.im_parseDatasetPath(lv_relativePath);
        if (!lv_parsedPath) continue;

        if (lv_parsedPath.kind === "images") {
          if (!IMPORT_IMAGE_FILE_EXTENSION_PATTERN.test(lv_parsedPath.relativePath)) continue;
          lv_imageCandidates.push({
            file: p_file,
            split: lv_parsedPath.split,
            relativePathInSplit: lv_parsedPath.relativePath,
          });
          lv_splitCountsFromFolder[lv_parsedPath.split] += 1;
          continue;
        }

        if (!/\.txt$/i.test(lv_parsedPath.relativePath)) continue;

        const lv_key = `${lv_parsedPath.split}/${this.im_removeFileExtension(
          lv_parsedPath.relativePath.toLowerCase()
        )}`;
        lv_labelFileByKey.set(lv_key, p_file);
      }

      if (lv_imageCandidates.length === 0) {
        this.iv_statusMessage =
          "Dataset import failed: no images were found under train/valid/test/images.";
        this.im_notifyChange();
        return;
      }

      const lv_labelTextByKey = new Map<string, string>();
      let lv_maxClassId = -1;

      for (const [p_key, p_labelFile] of lv_labelFileByKey.entries()) {
        const lv_text = await p_labelFile.text();
        lv_labelTextByKey.set(p_key, lv_text);
        lv_maxClassId = Math.max(lv_maxClassId, this.im_getMaxClassIdFromYoloText(lv_text));
      }

      let lv_yamlCategoryNames: string[] = [];
      if (lv_dataYamlFile) {
        const lv_dataYamlText = await lv_dataYamlFile.text();
        lv_yamlCategoryNames = this.im_parseCategoryNamesFromDataYaml(lv_dataYamlText);
      }
      const lv_baseCategoryNames =
        lv_yamlCategoryNames.length > 0 ? lv_yamlCategoryNames : [...DEFAULT_LABEL_CATEGORIES];
      const lv_categoryNames = this.im_expandCategoryNamesByClassId(lv_baseCategoryNames, lv_maxClassId);

      const lv_sortedImages = lv_imageCandidates.slice().sort((p_a, p_b) => {
        const lv_splitOrderDiff = this.im_getSplitOrder(p_a.split) - this.im_getSplitOrder(p_b.split);
        if (lv_splitOrderDiff !== 0) return lv_splitOrderDiff;
        return p_a.relativePathInSplit.localeCompare(p_b.relativePathInSplit);
      });

      const lv_nextImages: RouterImageItem[] = [];
      const lv_nextBoxesByImage: Record<string, BoundingBox[]> = {};
      let lv_nextBoxSequence = 1;

      for (let lv_i = 0; lv_i < lv_sortedImages.length; lv_i += 1) {
        const lv_candidate = lv_sortedImages[lv_i];
        const lv_objectUrl = URL.createObjectURL(lv_candidate.file);
        lv_nextObjectUrls.push(lv_objectUrl);

        const lv_relativePath = `${lv_candidate.split}/images/${lv_candidate.relativePathInSplit}`;
        const lv_imageId = `img_${lv_i}_${lv_relativePath}`;
        const lv_labelKey = `${lv_candidate.split}/${this.im_removeFileExtension(
          lv_candidate.relativePathInSplit.toLowerCase()
        )}`;
        const lv_labelText = lv_labelTextByKey.get(lv_labelKey) || "";

        lv_nextImages.push({
          id: lv_imageId,
          relativePath: lv_relativePath,
          url: lv_objectUrl,
        });

        if (lv_labelText.trim().length > 0) {
          const lv_imageSize = await this.im_getImageSizeFromBlob(lv_candidate.file);
          const lv_boxes = this.im_parseYoloLabelText(
            lv_labelText,
            lv_imageSize,
            lv_categoryNames,
            () => `box_${lv_nextBoxSequence++}`
          );

          if (lv_boxes.length > 0) {
            lv_nextBoxesByImage[lv_imageId] = lv_boxes;
          }
        }

        this.iv_statusMessage = `Importing dataset... ${lv_i + 1}/${lv_sortedImages.length}`;
        this.im_notifyChange();
      }

      this.iv_images = lv_nextImages;
      this.iv_currentIndex = 0;
      this.iv_boxesByImage = lv_nextBoxesByImage;
      this.iv_selectedBoxId = null;
      this.iv_draftBox = null;
      this.iv_dragState = { mode: "idle" };
      this.iv_boxSequence = Math.max(this.iv_boxSequence, lv_nextBoxSequence);
      this.iv_labelCategories = lv_categoryNames;
      this.iv_labelInput = lv_categoryNames[0] || DEFAULT_LABEL;
      this.iv_categoryDraftName = "";
      this.iv_categoryStatusMessage = "";

      const lv_totalImages = lv_sortedImages.length;
      const lv_trainPercent = this.im_normalizeSplitPercent(
        (lv_splitCountsFromFolder.train / lv_totalImages) * 100
      );
      const lv_validBoundaryPercent = this.im_normalizeSplitPercent(
        ((lv_splitCountsFromFolder.train + lv_splitCountsFromFolder.valid) / lv_totalImages) * 100
      );
      this.iv_splitTrainPercent = Math.min(lv_trainPercent, lv_validBoundaryPercent);
      this.iv_splitValidBoundaryPercent = Math.max(this.iv_splitTrainPercent, lv_validBoundaryPercent);

      this.im_revokeLocalImageObjectUrls();
      this.iv_localImageObjectUrls = lv_nextObjectUrls;

      const lv_totalBoxes = Object.values(lv_nextBoxesByImage).reduce((p_sum, p_boxes) => p_sum + p_boxes.length, 0);
      this.iv_statusMessage = `Dataset import complete: ${lv_totalImages} images, ${lv_totalBoxes} boxes`;
      this.im_notifyChange();
      this.im_startCurrentImageLoading();
    } catch (p_error) {
      lv_nextObjectUrls.forEach((p_url) => {
        URL.revokeObjectURL(p_url);
      });
      console.error("[BoundingBoxWorkspace] dataset import failed:", p_error);
      this.iv_statusMessage = "Dataset import failed. Check the exported folder structure.";
      this.im_notifyChange();
    } finally {
      this.iv_isImporting = false;
      this.im_notifyChange();
    }
  }

  /**
   * @param p_file input 파일 객체
   * @returns 브라우저 상대 경로(없으면 파일명)
   */
  private im_getInputFileRelativePath(p_file: File): string {
    const lv_fileWithPath = p_file as File & { webkitRelativePath?: string };
    return (lv_fileWithPath.webkitRelativePath || p_file.name).replace(/\\/g, "/");
  }

  /**
   * @param p_relativePath 입력 파일 상대 경로
   * @returns train/valid/test 내부 파일인지 파싱 결과
   */
  private im_parseDatasetPath(p_relativePath: string): ParsedDatasetPath | null {
    const lv_normalized = p_relativePath.replace(/\\/g, "/").replace(/^\/+/, "").trim();
    if (!lv_normalized) return null;

    const lv_match = lv_normalized.match(/(?:^|\/)(train|valid|val|test)\/(images|labels)\/(.+)$/i);
    if (!lv_match) return null;

    const lv_rawSplit = lv_match[1].toLowerCase();
    const lv_split: ExportSplit = lv_rawSplit === "val" ? "valid" : (lv_rawSplit as ExportSplit);
    const lv_kind = lv_match[2].toLowerCase() as DatasetFileKind;
    const lv_innerPath = lv_match[3].replace(/^\/+/, "").trim();
    if (!lv_innerPath) return null;

    return {
      split: lv_split,
      kind: lv_kind,
      relativePath: lv_innerPath,
    };
  }

  /**
   * @param p_split split 명칭
   * @returns split 정렬 우선순위
   */
  private im_getSplitOrder(p_split: ExportSplit): number {
    if (p_split === "train") return 0;
    if (p_split === "valid") return 1;
    return 2;
  }

  /**
   * @param p_text YOLO txt 파일 본문
   * @returns 본문에 포함된 최대 class id
   */
  private im_getMaxClassIdFromYoloText(p_text: string): number {
    let lv_maxClassId = -1;

    p_text.split(/\r?\n/).forEach((p_line) => {
      const lv_tokens = p_line.trim().split(/\s+/);
      if (lv_tokens.length < 5) return;
      const lv_classId = Number(lv_tokens[0]);
      if (!Number.isInteger(lv_classId) || lv_classId < 0) return;
      lv_maxClassId = Math.max(lv_maxClassId, lv_classId);
    });

    return lv_maxClassId;
  }

  /**
   * @param p_dataYamlText data.yaml 파일 본문
   * @returns 파싱된 카테고리 이름 배열
   */
  private im_parseCategoryNamesFromDataYaml(p_dataYamlText: string): string[] {
    const lv_inlineNamesMatch = p_dataYamlText.match(/^\s*names\s*:\s*\[(.*)\]\s*$/m);
    if (lv_inlineNamesMatch) {
      const lv_inlineBody = lv_inlineNamesMatch[1];
      const lv_inlineTokens = lv_inlineBody.match(/'[^']*'|"[^"]*"|[^,\s][^,]*/g) || [];
      const lv_inlineNames = lv_inlineTokens
        .map((p_token) => p_token.trim().replace(/^['"]|['"]$/g, ""))
        .map((p_token) => p_token.trim())
        .filter((p_token) => p_token.length > 0);

      if (lv_inlineNames.length > 0) {
        return lv_inlineNames;
      }
    }

    const lv_lines = p_dataYamlText.split(/\r?\n/);
    const lv_numberedNames: string[] = [];
    let lv_namesBlockFound = false;

    for (let lv_i = 0; lv_i < lv_lines.length; lv_i += 1) {
      const lv_line = lv_lines[lv_i];
      if (!lv_namesBlockFound) {
        if (/^\s*names\s*:\s*$/.test(lv_line)) {
          lv_namesBlockFound = true;
        }
        continue;
      }

      if (/^\s*$/.test(lv_line)) continue;
      if (/^\S/.test(lv_line)) break;

      const lv_itemMatch = lv_line.match(/^\s*(\d+)\s*:\s*(.+?)\s*$/);
      if (!lv_itemMatch) continue;

      const lv_index = Number(lv_itemMatch[1]);
      if (!Number.isInteger(lv_index) || lv_index < 0) continue;

      const lv_name = lv_itemMatch[2]
        .split("#")[0]
        .trim()
        .replace(/^['"]|['"]$/g, "")
        .trim();
      if (!lv_name) continue;

      lv_numberedNames[lv_index] = lv_name;
    }

    return lv_numberedNames.filter((p_name) => typeof p_name === "string" && p_name.length > 0);
  }

  /**
   * @param p_categoryNames 기본 카테고리 목록
   * @param p_maxClassId 라벨에서 감지된 최대 class id
   * @returns class id 길이에 맞게 보정된 카테고리 목록
   */
  private im_expandCategoryNamesByClassId(p_categoryNames: string[], p_maxClassId: number): string[] {
    const lv_nextNames = p_categoryNames.map((p_name) => p_name.trim());
    for (let lv_classId = 0; lv_classId <= p_maxClassId; lv_classId += 1) {
      if (!lv_nextNames[lv_classId]) {
        lv_nextNames[lv_classId] = `class_${lv_classId}`;
      }
    }

    return lv_nextNames.filter((p_name) => p_name.length > 0);
  }

  /**
   * @param p_labelText label txt 본문
   * @param p_imageSize 원본 이미지 크기
   * @param p_categoryNames class id별 카테고리 이름
   * @param p_getNextBoxId 박스 id 생성 콜백
   * @returns 파싱된 박스 목록(px)
   */
  private im_parseYoloLabelText(
    p_labelText: string,
    p_imageSize: ImageSize,
    p_categoryNames: string[],
    p_getNextBoxId: () => string
  ): BoundingBox[] {
    const lv_boxes: BoundingBox[] = [];
    if (p_imageSize.width <= 0 || p_imageSize.height <= 0) return lv_boxes;

    p_labelText.split(/\r?\n/).forEach((p_line) => {
      const lv_tokens = p_line.trim().split(/\s+/);
      if (lv_tokens.length < 5) return;

      const lv_classId = Number(lv_tokens[0]);
      const lv_cx = Number(lv_tokens[1]);
      const lv_cy = Number(lv_tokens[2]);
      const lv_w = Number(lv_tokens[3]);
      const lv_h = Number(lv_tokens[4]);

      if (!Number.isInteger(lv_classId) || lv_classId < 0) return;
      if (!Number.isFinite(lv_cx) || !Number.isFinite(lv_cy) || !Number.isFinite(lv_w) || !Number.isFinite(lv_h))
        return;
      if (lv_w <= 0 || lv_h <= 0) return;

      const lv_boxW = gf_clamp(lv_w * p_imageSize.width, 0, p_imageSize.width);
      const lv_boxH = gf_clamp(lv_h * p_imageSize.height, 0, p_imageSize.height);
      if (lv_boxW <= 0 || lv_boxH <= 0) return;

      const lv_centerX = lv_cx * p_imageSize.width;
      const lv_centerY = lv_cy * p_imageSize.height;
      const lv_boxX = gf_clamp(lv_centerX - lv_boxW / 2, 0, Math.max(0, p_imageSize.width - lv_boxW));
      const lv_boxY = gf_clamp(lv_centerY - lv_boxH / 2, 0, Math.max(0, p_imageSize.height - lv_boxH));
      const lv_label = p_categoryNames[lv_classId] || `class_${lv_classId}`;

      lv_boxes.push({
        id: p_getNextBoxId(),
        x: lv_boxX,
        y: lv_boxY,
        w: lv_boxW,
        h: lv_boxH,
        label: lv_label,
      });
    });

    return lv_boxes;
  }

  /**
   * @param p_box 리사이즈 대상 박스
   * @returns 리사이즈 핸들 중심 좌표 목록
   */
  private im_getResizeHandlePoints(p_box: BoundingBox) {
    return [
      { handle: "nw" as const, x: p_box.x, y: p_box.y },
      { handle: "n" as const, x: p_box.x + p_box.w / 2, y: p_box.y },
      { handle: "ne" as const, x: p_box.x + p_box.w, y: p_box.y },
      { handle: "e" as const, x: p_box.x + p_box.w, y: p_box.y + p_box.h / 2 },
      { handle: "se" as const, x: p_box.x + p_box.w, y: p_box.y + p_box.h },
      { handle: "s" as const, x: p_box.x + p_box.w / 2, y: p_box.y + p_box.h },
      { handle: "sw" as const, x: p_box.x, y: p_box.y + p_box.h },
      { handle: "w" as const, x: p_box.x, y: p_box.y + p_box.h / 2 },
    ];
  }

  /**
   * @param p_x 이미지 기준 X
   * @param p_y 이미지 기준 Y
   * @param p_box 리사이즈 핸들을 판별할 박스
   * @returns 히트된 리사이즈 핸들 또는 null
   */
  private im_findResizeHandle(p_x: number, p_y: number, p_box: BoundingBox | null): ResizeHandle | null {
    if (!p_box || this.pt_canvasSize.scale <= 0) return null;

    const lv_halfHitSize = (RESIZE_HANDLE_HIT_SIZE / this.pt_canvasSize.scale) / 2;

    for (const p_handlePoint of this.im_getResizeHandlePoints(p_box)) {
      if (
        p_x >= p_handlePoint.x - lv_halfHitSize &&
        p_x <= p_handlePoint.x + lv_halfHitSize &&
        p_y >= p_handlePoint.y - lv_halfHitSize &&
        p_y <= p_handlePoint.y + lv_halfHitSize
      ) {
        return p_handlePoint.handle;
      }
    }

    return null;
  }

  /**
   * @param p_handle 리사이즈 핸들 위치
   * @returns 해당 핸들에 대응하는 CSS cursor 값
   */
  private im_getResizeCursor(p_handle: ResizeHandle): string {
    if (p_handle === "n" || p_handle === "s") return "ns-resize";
    if (p_handle === "e" || p_handle === "w") return "ew-resize";
    if (p_handle === "ne" || p_handle === "sw") return "nesw-resize";
    return "nwse-resize";
  }

  /**
   * @description 현재 드래그/호버 상태에 따라 캔버스 커서를 동기화
   */
  private im_syncCanvasCursor() {
    const lv_canvasElement = this.iv_canvasElement;
    if (!lv_canvasElement) return;

    if (!this.iv_loadedImage || this.iv_isLoadingImage) {
      lv_canvasElement.style.cursor = "default";
      return;
    }

    if (this.iv_dragState.mode === "drawing") {
      lv_canvasElement.style.cursor = "crosshair";
      return;
    }

    if (this.iv_dragState.mode === "moving") {
      lv_canvasElement.style.cursor = "grabbing";
      return;
    }

    if (this.iv_dragState.mode === "resizing") {
      lv_canvasElement.style.cursor = this.im_getResizeCursor(this.iv_dragState.handle);
      return;
    }

    if (this.iv_hoverPoint) {
      const lv_handle = this.im_findResizeHandle(
        this.iv_hoverPoint.x,
        this.iv_hoverPoint.y,
        this.pt_selectedBox
      );
      if (lv_handle) {
        lv_canvasElement.style.cursor = this.im_getResizeCursor(lv_handle);
        return;
      }

      if (this.im_findHitBox(this.iv_hoverPoint.x, this.iv_hoverPoint.y)) {
        lv_canvasElement.style.cursor = "grab";
        return;
      }
    }

    lv_canvasElement.style.cursor = "crosshair";
  }

  /**
   * @param p_initialBox 리사이즈 시작 시점 박스
   * @param p_handle 사용 중인 핸들
   * @param p_x 현재 이미지 기준 X
   * @param p_y 현재 이미지 기준 Y
   * @returns 리사이즈 계산이 반영된 박스
   */
  private im_buildResizedBox(
    p_initialBox: BoundingBox,
    p_handle: ResizeHandle,
    p_x: number,
    p_y: number
  ): BoundingBox {
    let lv_left = p_initialBox.x;
    let lv_top = p_initialBox.y;
    let lv_right = p_initialBox.x + p_initialBox.w;
    let lv_bottom = p_initialBox.y + p_initialBox.h;

    if (p_handle.includes("w")) {
      lv_left = gf_clamp(p_x, 0, Math.max(0, lv_right - MIN_BOX_SIZE));
    }

    if (p_handle.includes("e")) {
      lv_right = gf_clamp(
        p_x,
        Math.min(this.iv_naturalSize.width, lv_left + MIN_BOX_SIZE),
        this.iv_naturalSize.width
      );
    }

    if (p_handle.includes("n")) {
      lv_top = gf_clamp(p_y, 0, Math.max(0, lv_bottom - MIN_BOX_SIZE));
    }

    if (p_handle.includes("s")) {
      lv_bottom = gf_clamp(
        p_y,
        Math.min(this.iv_naturalSize.height, lv_top + MIN_BOX_SIZE),
        this.iv_naturalSize.height
      );
    }

    return {
      ...p_initialBox,
      x: lv_left,
      y: lv_top,
      w: Math.max(MIN_BOX_SIZE, lv_right - lv_left),
      h: Math.max(MIN_BOX_SIZE, lv_bottom - lv_top),
    };
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
    this.iv_hoverPoint = null;
    this.iv_draftBox = null;
    this.iv_selectedBoxId = null;
    this.im_startCurrentImageLoading();
  }

  /**
   * @description 서버 라우터(/images/list)에서 이미지 목록을 로드
   */
  public async im_loadImageList() {
    if (this.iv_isImporting) return;

    this.im_revokeLocalImageObjectUrls();
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
      this.iv_hoverPoint = null;

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
      this.iv_hoverPoint = null;
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
    this.iv_hoverPoint = null;
    this.iv_draftBox = null;
    this.iv_selectedBoxId = null;

    if (!lv_currentImage) {
      this.iv_loadedImage = null;
      this.iv_naturalSize = { width: 0, height: 0 };
      this.iv_isLoadingImage = false;
      this.iv_statusMessage = "Pass an image to begin labeling.";
      this.im_notifyChange();
      return;
    }

    this.iv_isLoadingImage = true;
    this.iv_statusMessage = `Loading image: ${lv_currentImage.relativePath}`;
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
   * @returns 히트된 박스 목록(위에서 아래 순서)
   * @description 지정 좌표에 포함된 박스를 Z-order 기준으로 수집
   */
  private im_findHitBoxes(p_x: number, p_y: number): BoundingBox[] {
    const lv_currentBoxes = this.pt_currentBoxes;
    const lv_hitBoxes: BoundingBox[] = [];

    for (let lv_i = lv_currentBoxes.length - 1; lv_i >= 0; lv_i -= 1) {
      const lv_box = lv_currentBoxes[lv_i];
      if (
        p_x >= lv_box.x &&
        p_x <= lv_box.x + lv_box.w &&
        p_y >= lv_box.y &&
        p_y <= lv_box.y + lv_box.h
      ) {
        lv_hitBoxes.push(lv_box);
      }
    }

    return lv_hitBoxes;
  }

  /**
   * @param p_x 이미지 기준 X
   * @param p_y 이미지 기준 Y
   * @returns 히트된 박스 또는 null
   * @description 지정 좌표에 포함된 최상단 박스를 탐색
   */
  private im_findHitBox(p_x: number, p_y: number): BoundingBox | null {
    return this.im_findHitBoxes(p_x, p_y)[0] || null;
  }

  /**
   * @param p_hitBoxes 겹쳐 선택 가능한 박스 목록(위에서 아래 순서)
   * @returns 다음으로 선택할 박스 또는 null
   * @description Alt+클릭 시 현재 선택 기준으로 겹친 박스를 순환 선택
   */
  private im_getNextOverlappingSelection(p_hitBoxes: BoundingBox[]): BoundingBox | null {
    if (p_hitBoxes.length === 0) return null;

    if (!this.iv_selectedBoxId) {
      return p_hitBoxes[0];
    }

    const lv_selectedIndex = p_hitBoxes.findIndex((p_box) => p_box.id === this.iv_selectedBoxId);
    if (lv_selectedIndex < 0) {
      return p_hitBoxes[0];
    }

    return p_hitBoxes[(lv_selectedIndex + 1) % p_hitBoxes.length] || null;
  }

  /**
   * @param p_event 캔버스 마우스 다운 이벤트
   * @description 박스 선택/이동/리사이즈 시작 또는 신규 박스 드로잉 시작
   */
  public im_handleMouseDown(p_event: React.MouseEvent<HTMLCanvasElement>) {
    if (!this.pt_currentImage || !this.iv_loadedImage) return;

    const lv_point = this.im_getImagePointFromMouse(p_event);
    if (!lv_point) return;

    this.iv_hoverPoint = lv_point;
    const lv_forceDrawing = p_event.shiftKey;
    const lv_cycleOverlapSelection = p_event.altKey;
    const lv_selectedBox = this.pt_selectedBox;
    const lv_hitBoxes = this.im_findHitBoxes(lv_point.x, lv_point.y);

    if (lv_cycleOverlapSelection) {
      const lv_nextBox = this.im_getNextOverlappingSelection(lv_hitBoxes);
      this.iv_selectedBoxId = lv_nextBox?.id || null;
      this.iv_dragState = { mode: "idle" };
      this.iv_draftBox = null;
      this.im_notifyChange();
      return;
    }

    if (!lv_forceDrawing) {
      const lv_resizeHandle = this.im_findResizeHandle(lv_point.x, lv_point.y, lv_selectedBox);
      if (lv_resizeHandle && lv_selectedBox) {
        this.iv_selectedBoxId = lv_selectedBox.id;
        this.iv_dragState = {
          mode: "resizing",
          boxId: lv_selectedBox.id,
          handle: lv_resizeHandle,
          initialBox: { ...lv_selectedBox },
        };
        this.im_notifyChange();
        return;
      }
    }

    const lv_hitBox = lv_hitBoxes[0] || null;
    if (lv_hitBox && !lv_forceDrawing) {
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
   * @description 드로잉 중 임시 박스 갱신, 선택 박스 이동, 리사이즈를 처리
   */
  public im_handleMouseMove(p_event: React.MouseEvent<HTMLCanvasElement>) {
    const lv_point = this.im_getImagePointFromMouse(p_event);
    if (!lv_point) return;

    this.iv_hoverPoint = lv_point;
    const lv_dragState = this.iv_dragState;
    if (lv_dragState.mode === "idle") {
      this.im_syncCanvasCursor();
      return;
    }

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
      return;
    }

    if (lv_dragState.mode === "resizing") {
      this.im_updateCurrentBoxes((p_prevBoxes) =>
        p_prevBoxes.map((p_box) => {
          if (p_box.id !== lv_dragState.boxId) return p_box;
          return this.im_buildResizedBox(lv_dragState.initialBox, lv_dragState.handle, lv_point.x, lv_point.y);
        })
      );
      this.iv_selectedBoxId = lv_dragState.boxId;
      this.im_notifyChange();
    }
  }

  /**
   * @param p_event 캔버스 마우스 업 이벤트
   * @description 드로잉/이동/리사이즈를 종료하고 신규 드로잉이면 박스를 확정
   */
  public im_handleMouseUp(p_event: React.MouseEvent<HTMLCanvasElement>) {
    const lv_dragState = this.iv_dragState;
    if (lv_dragState.mode === "idle") return;

    const lv_point = this.im_getImagePointFromMouse(p_event);
    this.iv_hoverPoint = lv_point;

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
    this.iv_hoverPoint = null;
    this.im_syncCanvasCursor();
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
   * @description Exports the current labeling result as a dataset directory
   */
  public async im_exportYolo26Dataset() {
    if (this.iv_isExporting || this.iv_isImporting) return;

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
    this.iv_statusMessage = "Preparing dataset export.";
    this.im_notifyChange();

    try {
      const lv_baseDirectory = await lv_showDirectoryPicker();
      const lv_exportFolderName = `react-image-labeler-export_${this.im_getExportTimestampToken()}`;
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

        this.iv_statusMessage = `Exporting dataset... ${lv_i + 1}/${lv_exportTargets.length} (${lv_target.image.relativePath})`;
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

      this.iv_statusMessage = `Dataset export complete: ${lv_exportFolderName} (${lv_exportTargets.length} images)`;
    } catch (p_error) {
      if (p_error instanceof DOMException && p_error.name === "AbortError") {
        this.iv_statusMessage = "Dataset export was canceled.";
      } else {
        console.error("[BoundingBoxWorkspace] dataset export failed:", p_error);
        this.iv_statusMessage = "Dataset export failed.";
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
    const lv_sortedImages = this.iv_images
      .slice()
      .sort((p_a, p_b) => p_a.relativePath.localeCompare(p_b.relativePath));
    const lv_splitCounts = this.im_buildSplitCounts(lv_sortedImages.length);
    const lv_trainEnd = lv_splitCounts.train;
    const lv_validEnd = lv_splitCounts.train + lv_splitCounts.valid;

    return lv_sortedImages.map((p_image, p_index) => {
      let lv_split: ExportSplit = "test";
      if (p_index < lv_trainEnd) {
        lv_split = "train";
      } else if (p_index < lv_validEnd) {
        lv_split = "valid";
      }

      return {
        image: p_image,
        split: lv_split,
        exportFileName: this.im_buildExportFileName(p_image.relativePath),
      };
    });
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
      `# react-image-labeler export > ${lv_exportedAt}`,
      "",
      "Exported by react-image-labeler",
      "",
      `Total images: ${p_totalImages}`,
      `train: ${p_splitCounts.train}`,
      `valid: ${p_splitCounts.valid}`,
      `test: ${p_splitCounts.test}`,
      `split ratio: ${this.pt_splitTrainPercent}/${this.pt_splitValidPercent}/${this.pt_splitTestPercent}`,
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
        "Pass an image to begin labeling.",
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

      if (lv_isSelected) {
        const lv_handleHalfSize = RESIZE_HANDLE_SIZE / 2;
        lv_ctx.fillStyle = "#ffffff";
        lv_ctx.strokeStyle = "#ff9800";
        lv_ctx.lineWidth = 1.5;

        this.im_getResizeHandlePoints(p_box).forEach((p_handlePoint) => {
          const lv_handleX = p_handlePoint.x * lv_canvasSize.scale - lv_handleHalfSize;
          const lv_handleY = p_handlePoint.y * lv_canvasSize.scale - lv_handleHalfSize;

          lv_ctx.fillRect(lv_handleX, lv_handleY, RESIZE_HANDLE_SIZE, RESIZE_HANDLE_SIZE);
          lv_ctx.strokeRect(lv_handleX, lv_handleY, RESIZE_HANDLE_SIZE, RESIZE_HANDLE_SIZE);
        });
      }
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
    this.im_revokeLocalImageObjectUrls();
    this.iv_canvasElement = null;
    this.iv_loadedImage = null;
    this.iv_dragState = { mode: "idle" };
    this.iv_hoverPoint = null;
    this.iv_draftBox = null;
    this.iv_isImporting = false;
    this.iv_isExporting = false;
  }
}
