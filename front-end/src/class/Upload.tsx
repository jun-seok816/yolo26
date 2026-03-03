export type SplitType = "train" | "valid" | "test" | "unknown";

export type LoadedImage = {
  id: string;
  name: string;
  relativePath: string;
  fileSize: number;
  originalSplit: SplitType;
  previewUrl: string;
};

const DEFAULT_STATUS_MESSAGE =
  "폴더를 선택하면 이미지 파일을 split 구분 없이 한 번에 불러옵니다.";

const SPLIT_PRIORITY: Record<SplitType, number> = {
  train: 0,
  valid: 1,
  test: 2,
  unknown: 3,
};

export class Upload {
  private iv_images: LoadedImage[] = [];
  private iv_selectedId: string | null = null;
  private iv_statusMessage: string = DEFAULT_STATUS_MESSAGE;
  private iv_onChange: () => void;

  constructor(p_onChange: () => void = () => {}) {
    this.iv_onChange = p_onChange;
  }

  /**
   * @description 현재 로드된 이미지 목록 반환
   */
  public get pt_images(): LoadedImage[] {
    return this.iv_images;
  }

  /**
   * @description 업로드 상태 메시지 반환
   */
  public get pt_statusMessage(): string {
    return this.iv_statusMessage;
  }

  /**
   * @description 현재 선택된 이미지 반환 (없으면 null)
   */
  public get pt_selectedImage(): LoadedImage | null {
    if (this.iv_images.length === 0) return null;
    return this.iv_images.find((item) => item.id === this.iv_selectedId) || this.iv_images[0];
  }

  /**
   * @description 원본 split 추정 통계 반환
   */
  public get pt_splitStats(): Record<SplitType, number> {
    const lv_stats: Record<SplitType, number> = {
      train: 0,
      valid: 0,
      test: 0,
      unknown: 0,
    };

    this.iv_images.forEach((p_image) => {
      lv_stats[p_image.originalSplit] += 1;
    });

    return lv_stats;
  }

  /**
   * @param p_input directory input 엘리먼트
   * @description 폴더 선택 모드 속성 부여
   */
  public im_prepareDirectoryInput(p_input: HTMLInputElement | null) {
    if (!p_input) return;

    const lv_input = p_input as HTMLInputElement & {
      webkitdirectory?: boolean;
      directory?: boolean;
    };

    lv_input.webkitdirectory = true;
    lv_input.directory = true;
  }

  /**
   * @param p_input 파일 input 엘리먼트
   * @description 폴더 선택 결과를 읽어 이미지 목록으로 갱신
   */
  public im_importFromDirectoryInput(p_input: HTMLInputElement) {
    const lv_files = Array.from(p_input.files || []);
    const lv_nextImages = this.im_buildImageList(lv_files);

    this.im_replaceImages(lv_nextImages);
    this.iv_statusMessage = `폴더에서 ${lv_files.length}개 파일을 읽어 ${lv_nextImages.length}개 이미지를 불러왔습니다.`;
    this.im_notifyChange();
    p_input.value = "";
  }

  /**
   * @param p_input 파일 input 엘리먼트
   * @description 개별 파일 선택 결과를 읽어 이미지 목록으로 갱신
   */
  public im_importFromFileInput(p_input: HTMLInputElement) {
    const lv_files = Array.from(p_input.files || []);
    const lv_nextImages = this.im_buildImageList(lv_files);

    this.im_replaceImages(lv_nextImages);
    this.iv_statusMessage = `선택한 파일 ${lv_files.length}개 중 ${lv_nextImages.length}개 이미지를 불러왔습니다.`;
    this.im_notifyChange();
    p_input.value = "";
  }

  /**
   * @param p_id 이미지 ID
   * @description 선택 이미지 변경
   */
  public im_selectImage(p_id: string) {
    if (this.iv_selectedId === p_id) return;
    this.iv_selectedId = p_id;
    this.im_notifyChange();
  }

  /**
   * @description 현재 로드된 이미지 목록 초기화
   */
  public im_clearLoadedImages() {
    this.im_replaceImages([]);
    this.iv_statusMessage = "이미지 목록을 비웠습니다.";
    this.im_notifyChange();
  }

  /**
   * @description object URL 자원 정리 (언마운트/종료 시 호출)
   */
  public im_dispose() {
    this.im_revokeImageUrls(this.iv_images);
    this.iv_images = [];
    this.iv_selectedId = null;
    this.iv_statusMessage = DEFAULT_STATUS_MESSAGE;
  }

  /**
   * @param p_rawFiles input으로 받은 원본 파일 배열
   * @returns 미리보기 URL이 포함된 이미지 리스트
   * @description 이미지 파일만 필터링하고 중복 제거 후 정렬
   */
  private im_buildImageList(p_rawFiles: File[]): LoadedImage[] {
    const lv_dedupMap = new Map<string, LoadedImage>();

    p_rawFiles.forEach((p_file) => {
      if (!this.im_isImageFile(p_file)) return;

      const lv_relativePath = this.im_getRelativePath(p_file);
      const lv_split = this.im_detectOriginalSplit(lv_relativePath);
      const lv_dedupKey = `${lv_relativePath}__${p_file.size}__${p_file.lastModified}`;
      if (lv_dedupMap.has(lv_dedupKey)) return;

      lv_dedupMap.set(lv_dedupKey, {
        id: lv_dedupKey,
        name: p_file.name,
        relativePath: lv_relativePath,
        fileSize: p_file.size,
        originalSplit: lv_split,
        previewUrl: URL.createObjectURL(p_file),
      });
    });

    return [...lv_dedupMap.values()].sort((p_a, p_b) => {
      const lv_splitDiff = SPLIT_PRIORITY[p_a.originalSplit] - SPLIT_PRIORITY[p_b.originalSplit];
      if (lv_splitDiff !== 0) return lv_splitDiff;
      return p_a.relativePath.localeCompare(p_b.relativePath);
    });
  }

  /**
   * @param p_nextImages 다음 이미지 리스트
   * @description 기존 URL 정리 후 내부 목록/선택 상태 교체
   */
  private im_replaceImages(p_nextImages: LoadedImage[]) {
    this.im_revokeImageUrls(this.iv_images);
    this.iv_images = p_nextImages;
    this.iv_selectedId = p_nextImages[0]?.id || null;
  }

  /**
   * @param p_images URL 정리할 이미지 리스트
   * @description createObjectURL로 만든 리소스 해제
   */
  private im_revokeImageUrls(p_images: LoadedImage[]) {
    p_images.forEach((p_item) => {
      URL.revokeObjectURL(p_item.previewUrl);
    });
  }

  /**
   * @description 외부 렌더 트리거 콜백 실행
   */
  private im_notifyChange() {
    this.iv_onChange();
  }

  /**
   * @param p_file 파일 객체
   * @returns 브라우저 상대 경로(없으면 파일명)
   */
  private im_getRelativePath(p_file: File): string {
    const lv_fileWithPath = p_file as File & { webkitRelativePath?: string };
    return (lv_fileWithPath.webkitRelativePath || p_file.name).replace(/\\/g, "/");
  }

  /**
   * @param p_path 파일 경로
   * @returns 경로 기준 split 추정값
   */
  private im_detectOriginalSplit(p_path: string): SplitType {
    const lv_normalized = p_path.toLowerCase();
    if (/(^|\/)train\/images\//.test(lv_normalized)) return "train";
    if (/(^|\/)(valid|val)\/images\//.test(lv_normalized)) return "valid";
    if (/(^|\/)test\/images\//.test(lv_normalized)) return "test";
    return "unknown";
  }

  /**
   * @param p_file 파일 객체
   * @returns 이미지 파일 여부
   * @description MIME 타입 + 확장자 기준 검사
   */
  private im_isImageFile(p_file: File): boolean {
    if (p_file.type.startsWith("image/")) return true;
    return /\.(png|jpe?g|webp|bmp|gif)$/i.test(p_file.name);
  }
}
