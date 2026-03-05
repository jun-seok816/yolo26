import React, { useState } from "react";
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
  lv_Obj.im_Prepare_Hooks();

  lv_Obj.im_UnMounted(() => {
    lv_Obj.pt_upload.im_dispose();
    lv_Obj.pt_bboxWorkspace.im_dispose();
  });

  const lv_workspace = lv_Obj.pt_bboxWorkspace;
  const lv_currentImagePath = lv_workspace.pt_currentImage?.relativePath || "";
  const lv_currentBoxes = lv_workspace.pt_currentBoxes;

  return (
    <div className="dataset-loader">
      <aside className="dataset-loader__aside">
        <UploadArea p_upload={lv_Obj.pt_upload} />
        <section className="dataset-loader__box-list">
          <div className="dataset-loader__box-list-header">
            <h3 className="dataset-loader__box-list-title">Labeling Box List</h3>
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
                      disabled={!lv_workspace.pt_selectedBoxId}
                      onClick={() => lv_workspace.im_deleteSelectedBox()}
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
    </div>
  );
}
