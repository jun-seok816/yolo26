import React, { useEffect, useRef, useState } from "react";
import "./DatasetLoaderPage.scss";
import { Main } from "@jsLib/class/Main";
import { Upload } from "@jsLib/class/Upload";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

class DataSet extends Main {
  public pt_upload: Upload;
  constructor() {
    super();
    this.pt_upload = new Upload(() => {
      this.im_forceRender();
    });
  }
}

export default function DatasetLoaderPage() {
  const [lv_Obj] = useState(() => new DataSet());
  lv_Obj.im_Prepare_Hooks();
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    lv_Obj.pt_upload.im_prepareDirectoryInput(directoryInputRef.current);
  }, [lv_Obj]);

  lv_Obj.im_UnMounted(() => {
    lv_Obj.pt_upload.im_dispose();
  });

  const lv_images = lv_Obj.pt_upload.pt_images;
  const lv_selectedImage = lv_Obj.pt_upload.pt_selectedImage;
  const lv_splitStats = lv_Obj.pt_upload.pt_splitStats;

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
        <button
          type="button"
          className="is-secondary"
          onClick={() => lv_Obj.pt_upload.im_clearLoadedImages()}
        >
          목록 비우기
        </button>
      </div>

      <input
        ref={directoryInputRef}
        type="file"
        hidden
        multiple
        onChange={(event) => lv_Obj.pt_upload.im_importFromDirectoryInput(event.currentTarget)}
      />
      <input
        ref={fileInputRef}
        type="file"
        hidden
        multiple
        accept="image/*"
        onChange={(event) => lv_Obj.pt_upload.im_importFromFileInput(event.currentTarget)}
      />

      <div className="dataset-loader__status">{lv_Obj.pt_upload.pt_statusMessage}</div>

      <div className="dataset-loader__summary">
        <span>전체: {lv_images.length}장</span>
        <span>train: {lv_splitStats.train}</span>
        <span>valid: {lv_splitStats.valid}</span>
        <span>test: {lv_splitStats.test}</span>
        <span>unknown: {lv_splitStats.unknown}</span>
      </div>

      <div className="dataset-loader__workspace">
        <aside className="dataset-loader__list">
          {lv_images.length === 0 && (
            <div className="dataset-loader__empty">
              폴더를 선택하면 이미지 파일을 전체 로드합니다. split은 라벨링 이후에 나누면 됩니다.
            </div>
          )}

          {lv_images.map((image, index) => {
            const isActive = lv_selectedImage?.id === image.id;
            return (
              <button
                key={image.id}
                type="button"
                className={`dataset-loader__item ${isActive ? "is-active" : ""}`}
                onClick={() => lv_Obj.pt_upload.im_selectImage(image.id)}
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
          {!lv_selectedImage && <div className="dataset-loader__empty">선택된 이미지가 없습니다.</div>}
          {lv_selectedImage && (
            <>
              <div className="dataset-loader__preview-image">
                <img src={lv_selectedImage.previewUrl} alt={lv_selectedImage.name} />
              </div>
              <div className="dataset-loader__preview-meta">
                <div>
                  <span>파일명</span>
                  <strong>{lv_selectedImage.name}</strong>
                </div>
                <div>
                  <span>경로</span>
                  <strong>{lv_selectedImage.relativePath}</strong>
                </div>
                <div>
                  <span>원본 split 추정</span>
                  <strong>{lv_selectedImage.originalSplit}</strong>
                </div>
                <div>
                  <span>용량</span>
                  <strong>{formatFileSize(lv_selectedImage.fileSize)}</strong>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
