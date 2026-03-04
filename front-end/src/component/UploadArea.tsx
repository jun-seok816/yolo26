import React, { useEffect, useRef, useState } from "react";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./UploadArea.scss";
import { Upload } from "@jsLib/class/Upload";

type UploadAreaProps = {
  p_upload: Upload;
};

export default function UploadArea({ p_upload }: UploadAreaProps) {
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lv_isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    p_upload.im_prepareDirectoryInput(directoryInputRef.current);
  }, [p_upload]);

  const im_handleDrop = (p_event: React.DragEvent<HTMLDivElement>) => {
    p_event.preventDefault();
    setIsDragOver(false);

    const lv_files = Array.from(p_event.dataTransfer.files || []);
    if (lv_files.length === 0) return;

    const lv_input = fileInputRef.current;
    if (!lv_input) return;

    const lv_transfer = new DataTransfer();
    lv_files.forEach((p_file) => {
      lv_transfer.items.add(p_file);
    });

    lv_input.files = lv_transfer.files;
    p_upload.im_importFromFileInput(lv_input);
  };

  return (
    <>
      <div
        className={`upload-card ${lv_isDragOver ? "is-drag-over" : ""}`}
        onDragOver={(p_event) => {
          p_event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={(p_event) => {
          if (p_event.currentTarget.contains(p_event.relatedTarget as Node)) return;
          setIsDragOver(false);
        }}
        onDrop={im_handleDrop}
      >
        <div className="upload-card__icon-wrap">
          <i className="bi bi-upload upload-card__icon" aria-hidden="true" />
        </div>
        <p className="upload-card__title">Drag and drop file(s) to upload, or:</p>
        <div className="upload-card__actions">
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            <i className="bi bi-file-earmark upload-card__button-icon" aria-hidden="true" />
            Select File(s)
          </button>
          <button type="button" onClick={() => directoryInputRef.current?.click()}>
            <i className="bi bi-folder upload-card__button-icon" aria-hidden="true" />
            Select Folder
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        multiple
        accept="image/*"
        onChange={(p_event) => p_upload.im_importFromFileInput(p_event.currentTarget)}
      />
      <input
        ref={directoryInputRef}
        type="file"
        hidden
        multiple
        onChange={(p_event) => p_upload.im_importFromDirectoryInput(p_event.currentTarget)}
      />
    </>
  );
}
