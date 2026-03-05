import React, { useEffect, useRef } from "react";
import "./BoundingBoxWorkspace.scss";
import { BoundingBoxWorkspaceData } from "@jsLib/class/BoundingBoxWorkspaceData";

type BoundingBoxWorkspaceProps = {
  p_workspace: BoundingBoxWorkspaceData;
};

export default function BoundingBoxWorkspace({ p_workspace }: BoundingBoxWorkspaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    void p_workspace.im_loadImageList();
  }, [p_workspace]);

  useEffect(() => {
    p_workspace.im_bindCanvasElement(canvasRef.current);
    p_workspace.im_drawScene();
  });

  const lv_images = p_workspace.pt_images;
  const lv_currentImage = p_workspace.pt_currentImage;
  const lv_currentBoxes = p_workspace.pt_currentBoxes;
  const lv_selectedBox = p_workspace.pt_selectedBox;
  const lv_selectedBoxNormalized = p_workspace.pt_selectedBoxNormalized;
  const lv_naturalSize = p_workspace.pt_naturalSize;

  return (
    <section className="bbox-workspace">
      <header className="bbox-workspace__header">
        <div className="bbox-workspace__title-wrap">
          <h2 className="bbox-workspace__title">Bounding Box Workspace</h2>
          <p className="bbox-workspace__status">{p_workspace.pt_statusMessage}</p>
        </div>
        <button type="button" className="bbox-workspace__refresh" onClick={() => void p_workspace.im_loadImageList()}>
          이미지 목록 새로고침
        </button>
      </header>

      <div className="bbox-workspace__toolbar">
        <div className="bbox-workspace__pager">
          <button
            type="button"
            disabled={lv_images.length === 0 || p_workspace.pt_currentIndex <= 0}
            onClick={() => p_workspace.im_movePrevImage()}
          >
            이전
          </button>
          <span>{lv_images.length === 0 ? "0 / 0" : `${p_workspace.pt_currentIndex + 1} / ${lv_images.length}`}</span>
          <button
            type="button"
            disabled={lv_images.length === 0 || p_workspace.pt_currentIndex >= lv_images.length - 1}
            onClick={() => p_workspace.im_moveNextImage()}
          >
            다음
          </button>
        </div>

        <div className="bbox-workspace__zoom">
          <button type="button" disabled={lv_images.length === 0} onClick={() => p_workspace.im_zoomOut()}>
            -
          </button>
          <span>{p_workspace.pt_zoomPercent}%</span>
          <button type="button" disabled={lv_images.length === 0} onClick={() => p_workspace.im_zoomIn()}>
            +
          </button>
          <button type="button" disabled={lv_images.length === 0} onClick={() => p_workspace.im_resetZoom()}>
            100%
          </button>
        </div>

        <label className="bbox-workspace__label-input">
          Label
          <select
            value={p_workspace.pt_labelInput}
            onChange={(p_event) => p_workspace.im_setLabelInput(p_event.currentTarget.value)}
          >
            {p_workspace.pt_labelCategories.map((p_category) => (
              <option key={p_category} value={p_category}>
                {p_category}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="bbox-workspace__danger"
          disabled={!p_workspace.pt_selectedBoxId}
          onClick={() => p_workspace.im_deleteSelectedBox()}
        >
          선택 박스 삭제
        </button>

        <button
          type="button"
          disabled={lv_currentBoxes.length === 0}
          onClick={() => p_workspace.im_clearCurrentBoxes()}
        >
          현재 이미지 박스 전체 삭제
        </button>
      </div>

      <div className="bbox-workspace__canvas-wrap">
        <canvas
          ref={canvasRef}
          className="bbox-workspace__canvas"
          onMouseDown={(p_event) => p_workspace.im_handleMouseDown(p_event)}
          onMouseMove={(p_event) => p_workspace.im_handleMouseMove(p_event)}
          onMouseUp={(p_event) => p_workspace.im_handleMouseUp(p_event)}
          onMouseLeave={(p_event) => p_workspace.im_handleMouseLeave(p_event)}
          onWheel={(p_event) => p_workspace.im_handleCanvasWheel(p_event)}
        />
        {p_workspace.pt_isLoadingImage && <div className="bbox-workspace__loading">이미지 로딩 중...</div>}
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
          <strong>박스 수:</strong> 현재 {lv_currentBoxes.length}개 / 전체 {p_workspace.pt_totalBoxCount}개
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
