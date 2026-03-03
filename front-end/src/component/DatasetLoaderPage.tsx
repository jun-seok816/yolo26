import React, { useEffect, useMemo, useRef, useState } from "react";
import "./DatasetLoaderPage.scss";
import { Main } from "@jsLib/class/Main_class";

type SplitType = "train" | "valid" | "test" | "unknown";

type LoadedImage = {
  id: string;
  name: string;
  relativePath: string;
  fileSize: number;
  originalSplit: SplitType;
  previewUrl: string;
};

type DirectoryInput = HTMLInputElement & {
  webkitdirectory?: boolean;
  directory?: boolean;
};

const SPLIT_PRIORITY: Record<SplitType, number> = {
  train: 0,
  valid: 1,
  test: 2,
  unknown: 3,
};

function getRelativePath(file: File): string {
  const fileWithPath = file as File & { webkitRelativePath?: string };
  return (fileWithPath.webkitRelativePath || file.name).replace(/\\/g, "/");
}

function detectOriginalSplit(path: string): SplitType {
  const normalized = path.toLowerCase();
  if (/(^|\/)train\/images\//.test(normalized)) return "train";
  if (/(^|\/)(valid|val)\/images\//.test(normalized)) return "valid";
  if (/(^|\/)test\/images\//.test(normalized)) return "test";
  return "unknown";
}

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

class DataSet extends Main {
  constructor() { 
    super();
  }
}

export default function DatasetLoaderPage() {
  const [lv_Obj] = useState(() => {
    return new DataSet();
  });

  lv_Obj.im_Prepare_Hooks(async () => {
   
  });
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>(
    "폴더를 선택하면 이미지 파일을 split 구분 없이 한 번에 불러옵니다."
  );

  useEffect(() => {
    const input = directoryInputRef.current as DirectoryInput | null;
    if (!input) return;

    input.webkitdirectory = true;
    input.directory = true;
  }, []);

  useEffect(() => {
    return () => {
      images.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [images]);

  const selectedImage = useMemo(() => {
    if (!images.length) return null;
    return images.find((item) => item.id === selectedId) || images[0];
  }, [images, selectedId]);

  const splitStats = useMemo(() => {
    const stats: Record<SplitType, number> = {
      train: 0,
      valid: 0,
      test: 0,
      unknown: 0,
    };

    images.forEach((image) => {
      stats[image.originalSplit] += 1;
    });

    return stats;
  }, [images]);

  function buildImageList(rawFiles: File[]): LoadedImage[] {
    const dedupMap = new Map<string, LoadedImage>();

    rawFiles.forEach((file) => {
      if (!isImageFile(file)) return;

      const relativePath = getRelativePath(file);
      const split = detectOriginalSplit(relativePath);

      const dedupKey = `${relativePath}__${file.size}__${file.lastModified}`;
      if (dedupMap.has(dedupKey)) return;

      dedupMap.set(dedupKey, {
        id: dedupKey,
        name: file.name,
        relativePath,
        fileSize: file.size,
        originalSplit: split,
        previewUrl: URL.createObjectURL(file),
      });
    });

    return [...dedupMap.values()].sort((a, b) => {
      const splitDiff = SPLIT_PRIORITY[a.originalSplit] - SPLIT_PRIORITY[b.originalSplit];
      if (splitDiff !== 0) return splitDiff;
      return a.relativePath.localeCompare(b.relativePath);
    });
  }

  function replaceImages(nextImages: LoadedImage[]) {
    setImages((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return nextImages;
    });

    if (!nextImages.length) {
      setSelectedId(null);
      return;
    }

    setSelectedId(nextImages[0].id);
  }

  function handleDirectoryImport(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    const nextImages = buildImageList(files);

    replaceImages(nextImages);
    setStatusMessage(
      `폴더에서 ${files.length}개 파일을 읽어 ${nextImages.length}개 이미지를 불러왔습니다.`
    );

    event.target.value = "";
  }

  function handleFileImport(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    const nextImages = buildImageList(files);

    replaceImages(nextImages);
    setStatusMessage(
      `선택한 파일 ${files.length}개 중 ${nextImages.length}개 이미지를 불러왔습니다.`
    );

    event.target.value = "";
  }

  function clearLoadedImages() {
    replaceImages([]);
    setStatusMessage("이미지 목록을 비웠습니다.");
  }

  return (
    <div className="dataset-loader">
      <header className="dataset-loader__header">
        <h1>YOLO Dataset Loader</h1>
        <p>지금은 split 구분 없이 모든 이미지를 모아서 확인하고 라벨링할 수 있도록 준비한 화면입니다.</p>
      </header>

      <div className="dataset-loader__actions">
        <button type="button" onClick={() => directoryInputRef.current?.click()}>
          example 폴더 불러오기
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          이미지 파일만 직접 선택
        </button>
        <button type="button" className="is-secondary" onClick={clearLoadedImages}>
          목록 비우기
        </button>
      </div>

      <input
        ref={directoryInputRef}
        type="file"
        hidden
        multiple
        onChange={handleDirectoryImport}
      />
      <input
        ref={fileInputRef}
        type="file"
        hidden
        multiple
        accept="image/*"
        onChange={handleFileImport}
      />

      <div className="dataset-loader__status">{statusMessage}</div>

      <div className="dataset-loader__summary">
        <span>전체: {images.length}장</span>
        <span>train: {splitStats.train}</span>
        <span>valid: {splitStats.valid}</span>
        <span>test: {splitStats.test}</span>
        <span>unknown: {splitStats.unknown}</span>
      </div>

      <div className="dataset-loader__workspace">
        <aside className="dataset-loader__list">
          {images.length === 0 && (
            <div className="dataset-loader__empty">
              폴더를 선택하면 이미지 파일을 전체 로드합니다. split은 라벨링 이후에 나누면 됩니다.
            </div>
          )}

          {images.map((image, index) => {
            const isActive = selectedImage?.id === image.id;
            return (
              <button
                key={image.id}
                type="button"
                className={`dataset-loader__item ${isActive ? "is-active" : ""}`}
                onClick={() => setSelectedId(image.id)}
              >
                <img src={image.previewUrl} alt={image.name} loading="lazy" />
                <div className="meta">
                  <strong>{index + 1}. {image.name}</strong>
                  <span>{image.relativePath}</span>
                </div>
              </button>
            );
          })}
        </aside>

        <section className="dataset-loader__preview">
          {!selectedImage && <div className="dataset-loader__empty">선택된 이미지가 없습니다.</div>}
          {selectedImage && (
            <>
              <div className="dataset-loader__preview-image">
                <img src={selectedImage.previewUrl} alt={selectedImage.name} />
              </div>
              <div className="dataset-loader__preview-meta">
                <div>
                  <span>파일명</span>
                  <strong>{selectedImage.name}</strong>
                </div>
                <div>
                  <span>경로</span>
                  <strong>{selectedImage.relativePath}</strong>
                </div>
                <div>
                  <span>원본 split 추정</span>
                  <strong>{selectedImage.originalSplit}</strong>
                </div>
                <div>
                  <span>용량</span>
                  <strong>{formatFileSize(selectedImage.fileSize)}</strong>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
