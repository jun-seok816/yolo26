import React, { useRef, useState } from "react";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./DatasetLoaderPage.scss";
import { Main } from "@jsLib/class/Main";
import { Upload } from "@jsLib/class/Upload";
import { BoundingBoxWorkspaceData } from "@jsLib/class/BoundingBoxWorkspaceData";
import UploadArea from "./UploadArea";
import BoundingBoxWorkspace from "./BoundingBoxWorkspace";

class DataSet extends Main {
  public pt_upload: Upload;
  public pt_bboxWorkspace: BoundingBoxWorkspaceData;

  constructor() {
    super();
    const lv_onChange = () => {
      this.im_forceRender();
    };

    this.pt_upload = new Upload(lv_onChange);
    this.pt_bboxWorkspace = new BoundingBoxWorkspaceData(lv_onChange);
  }
}

export default function DatasetLoaderPage() {
  const [lv_Obj] = useState(() => new DataSet());
  const [lv_isExportModalOpen, setExportModalOpen] = useState(false);
  const lv_importDirectoryInputRef = useRef<HTMLInputElement | null>(null);
  lv_Obj.im_Prepare_Hooks();

  lv_Obj.im_UnMounted(() => {
    lv_Obj.pt_upload.im_dispose();
    lv_Obj.pt_bboxWorkspace.im_dispose();
  });

  const lv_workspace = lv_Obj.pt_bboxWorkspace;
  const lv_currentImagePath = lv_workspace.pt_currentImage?.relativePath || "";
  const lv_currentBoxes = lv_workspace.pt_currentBoxes;
  const lv_isImporting = lv_workspace.pt_isImporting;
  const lv_isExporting = lv_workspace.pt_isExporting;
  const lv_isBusy = lv_isImporting || lv_isExporting;
  const lv_splitTrainPercent = lv_workspace.pt_splitTrainPercent;
  const lv_splitValidBoundaryPercent = lv_workspace.pt_splitValidBoundaryPercent;
  const lv_splitValidPercent = lv_workspace.pt_splitValidPercent;
  const lv_splitTestPercent = lv_workspace.pt_splitTestPercent;
  const lv_splitImageCounts = lv_workspace.pt_exportSplitImageCounts;
  const lv_totalImages = lv_workspace.pt_images.length;

  const lf_openExportModal = () => {
    if (lv_workspace.pt_images.length === 0 || lv_isBusy) return;
    setExportModalOpen(true);
  };

  const lf_closeExportModal = () => {
    if (lv_isBusy) return;
    setExportModalOpen(false);
  };

  const lf_openImportDirectoryPicker = () => {
    if (lv_isBusy) return;
    lv_importDirectoryInputRef.current?.click();
  };

  const lf_handleImportDirectoryChange = (p_event: React.ChangeEvent<HTMLInputElement>) => {
    setExportModalOpen(false);
    void lv_workspace.im_importYolo26FromDirectoryInput(p_event.currentTarget);
  };

  const lf_confirmExport = async () => {
    await lv_workspace.im_exportYolo26Dataset();
    setExportModalOpen(false);
  };

  return (
    <div className="dataset-loader">
      <aside className="dataset-loader__aside">
        <UploadArea p_upload={lv_Obj.pt_upload} />
        <input
          ref={(p_input) => {
            lv_importDirectoryInputRef.current = p_input;
            lv_workspace.im_prepareImportDirectoryInput(p_input);
          }}
          type="file"
          onChange={lf_handleImportDirectoryChange}
          style={{ display: "none" }}
        />
        <section className="dataset-loader__box-list">
          <div className="dataset-loader__box-list-header">
            <h3 className="dataset-loader__box-list-title">Labeling Box List</h3>
            <div className="dataset-loader__box-list-header-actions">
              <button
                type="button"
                className="dataset-loader__box-list-header-button is-import"
                disabled={lv_isBusy}
                onClick={lf_openImportDirectoryPicker}
              >
                <i className="bi bi-folder2-open dataset-loader__box-list-action-icon" aria-hidden="true" />
                {lv_isImporting ? "YOLO26 Import 중..." : "YOLO26 Import"}
              </button>
              <button
                type="button"
                className="dataset-loader__box-list-header-button"
                disabled={lv_isBusy || lv_workspace.pt_images.length === 0}
                onClick={lf_openExportModal}
              >
                <i className="bi bi-download dataset-loader__box-list-action-icon" aria-hidden="true" />
                {lv_isExporting ? "YOLO26 Export 중..." : "YOLO26 Export 설정"}
              </button>
            </div>
          </div>

          <p className="dataset-loader__box-list-meta">
            <strong>현재 이미지:</strong> {lv_currentImagePath || "-"}
          </p>
          <p className="dataset-loader__box-list-meta">
            <strong>현재/전체:</strong> {lv_currentBoxes.length} / {lv_workspace.pt_totalBoxCount}
          </p>

          {lv_currentBoxes.length === 0 ? (
            <p className="dataset-loader__box-list-empty">현재 이미지에 라벨링된 박스가 없습니다.</p>
          ) : (
            <ul className="dataset-loader__box-list-items">
              {lv_currentBoxes.map((p_box, p_index) => (
                <li
                  key={p_box.id}
                  className={`dataset-loader__box-list-item ${lv_workspace.pt_selectedBoxId === p_box.id ? "is-selected" : ""
                    }`}
                  onClick={() => lv_workspace.im_selectBoxById(p_box.id)}
                >
                  <div className="dataset-loader__box-list-item-top">
                    <span className="dataset-loader__box-list-item-label">
                      {p_index + 1}. {p_box.label}
                    </span>
                    <span className="dataset-loader__box-list-item-size">
                      {Math.round(p_box.w)} x {Math.round(p_box.h)}
                    </span>
                    <button
                      className="dataset-loader__box-list-actions"
                      type="button"                      
                      onClick={() => { lv_workspace.im_selectBoxById(p_box.id); lv_workspace.im_deleteSelectedBox(); }}
                    >
                      <i className="bi bi-trash dataset-loader__box-list-action-icon" aria-hidden="true" />
                    </button>
                  </div>
                  <p className="dataset-loader__box-list-item-coords">
                    x={p_box.x.toFixed(1)} y={p_box.y.toFixed(1)} w={p_box.w.toFixed(1)} h=
                    {p_box.h.toFixed(1)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
      <main className="dataset-loader__main">
        <BoundingBoxWorkspace p_workspace={lv_workspace} />
      </main>

      {lv_isExportModalOpen && (
        <div className="dataset-loader__export-modal-backdrop" role="presentation" onClick={lf_closeExportModal}>
          <section
            className="dataset-loader__export-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dataset-loader-export-title"
            onClick={(p_event) => p_event.stopPropagation()}
          >
            <header className="dataset-loader__export-modal-header">
              <h3 id="dataset-loader-export-title">YOLO26 Export Split</h3>
              <button type="button" onClick={lf_closeExportModal} disabled={lv_isBusy}>
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </header>

            <section className="dataset-loader__split-panel">
              <div className="dataset-loader__split-top">
                <span className="dataset-loader__split-chip is-train">
                  <i className="bi bi-stars" aria-hidden="true" /> Train
                </span>
                <span className="dataset-loader__split-chip is-valid">
                  <i className="bi bi-shield-check" aria-hidden="true" /> Valid
                </span>
                <span className="dataset-loader__split-chip is-test">
                  <i className="bi bi-pencil-square" aria-hidden="true" /> Test
                </span>
              </div>

              <div className="dataset-loader__split-percent">
                <span className="is-train">{lv_splitTrainPercent}%</span>
                <span className="is-valid">{lv_splitValidPercent}%</span>
                <span className="is-test">{lv_splitTestPercent}%</span>
              </div>

              <div className="dataset-loader__split-slider-wrap">
                <div className="dataset-loader__split-slider-track" aria-hidden="true">
                  <span
                    className="dataset-loader__split-slider-segment is-train"
                    style={{ width: `${lv_splitTrainPercent}%` }}
                  />
                  <span
                    className="dataset-loader__split-slider-segment is-valid"
                    style={{
                      left: `${lv_splitTrainPercent}%`,
                      width: `${lv_splitValidPercent}%`,
                    }}
                  />
                  <span
                    className="dataset-loader__split-slider-segment is-test"
                    style={{
                      left: `${lv_splitValidBoundaryPercent}%`,
                      width: `${lv_splitTestPercent}%`,
                    }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={lv_splitTrainPercent}
                  disabled={lv_isBusy}
                  className="dataset-loader__split-slider dataset-loader__split-slider--train"
                  onChange={(p_event) =>
                    lv_workspace.im_setSplitTrainPercent(Number(p_event.currentTarget.value))
                  }
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={lv_splitValidBoundaryPercent}
                  disabled={lv_isBusy}
                  className="dataset-loader__split-slider dataset-loader__split-slider--valid"
                  onChange={(p_event) =>
                    lv_workspace.im_setSplitValidBoundaryPercent(Number(p_event.currentTarget.value))
                  }
                />
              </div>

              <div className="dataset-loader__split-count">
                <span className="is-train">Train: {lv_splitImageCounts.train} images</span>
                <span className="is-valid">Valid: {lv_splitImageCounts.valid} images</span>
                <span className="is-test">Test: {lv_splitImageCounts.test} images</span>
              </div>
              <p className="dataset-loader__split-total">Total: {lv_totalImages} images</p>
            </section>

            <footer className="dataset-loader__export-modal-footer">
              <button type="button" className="is-cancel" onClick={lf_closeExportModal} disabled={lv_isBusy}>
                취소
              </button>
              <button
                type="button"
                className="is-confirm"
                onClick={() => void lf_confirmExport()}
                disabled={lv_isBusy || lv_workspace.pt_images.length === 0}
              >
                <i className="bi bi-download" aria-hidden="true" />
                {lv_isExporting ? "Export 중..." : "선택 후 Export"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
