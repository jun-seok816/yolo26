import React from "react";
import "./BoundingBoxBoxList.scss";
import { BoundingBoxWorkspaceData } from "@jsLib/class/BoundingBoxWorkspaceData";

type BoundingBoxBoxListProps = {
  p_workspace: BoundingBoxWorkspaceData;
};

export default function BoundingBoxBoxList({ p_workspace }: BoundingBoxBoxListProps) {
  const lv_currentImagePath = p_workspace.pt_currentImage?.relativePath || "-";
  const lv_currentBoxes = p_workspace.pt_currentBoxes;

  return (
    <section className="bbox-module-box-list">
      <div className="bbox-module-box-list__header">
        <h3 className="bbox-module-box-list__title">Labeling Box List</h3>
      </div>

      <p className="bbox-module-box-list__meta">
        <strong>현재 이미지:</strong> {lv_currentImagePath}
      </p>
      <p className="bbox-module-box-list__meta">
        <strong>현재/전체:</strong> {lv_currentBoxes.length} / {p_workspace.pt_totalBoxCount}
      </p>

      {lv_currentBoxes.length === 0 ? (
        <p className="bbox-module-box-list__empty">현재 이미지에 라벨링된 박스가 없습니다.</p>
      ) : (
        <ul className="bbox-module-box-list__items">
          {lv_currentBoxes.map((p_box, p_index) => (
            <li
              key={p_box.id}
              className={`bbox-module-box-list__item ${
                p_workspace.pt_selectedBoxId === p_box.id ? "is-selected" : ""
              }`}
              onClick={() => p_workspace.im_selectBoxById(p_box.id)}
            >
              <div className="bbox-module-box-list__item-top">
                <span className="bbox-module-box-list__item-label">
                  {p_index + 1}. {p_box.label}
                </span>
                <span className="bbox-module-box-list__item-size">
                  {Math.round(p_box.w)} x {Math.round(p_box.h)}
                </span>
              </div>
              <p className="bbox-module-box-list__item-coords">
                x={p_box.x.toFixed(1)} y={p_box.y.toFixed(1)} w={p_box.w.toFixed(1)} h={p_box.h.toFixed(1)}
              </p>
              <div className="bbox-module-box-list__item-actions">
                <button
                  type="button"
                  onClick={(p_event) => {
                    p_event.stopPropagation();
                    p_workspace.im_selectBoxById(p_box.id);
                    p_workspace.im_deleteSelectedBox();
                  }}
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
