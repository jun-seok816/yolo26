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

  useEffect(() => {
    const lf_isTypingTarget = (p_target: EventTarget | null): boolean => {
      if (!(p_target instanceof HTMLElement)) return false;
      if (p_target.isContentEditable) return true;

      const lv_tagName = p_target.tagName.toLowerCase();
      return lv_tagName === "input" || lv_tagName === "textarea" || lv_tagName === "select";
    };

    const lf_handleWindowKeyDown = (p_event: KeyboardEvent) => {
      if (p_event.key !== "Delete") return;
      if (!p_workspace.pt_selectedBoxId) return;
      if (lf_isTypingTarget(p_event.target)) return;

      p_event.preventDefault();
      p_workspace.im_deleteSelectedBox();
    };

    window.addEventListener("keydown", lf_handleWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", lf_handleWindowKeyDown);
    };
  }, [p_workspace]);

  const lv_images = p_workspace.pt_images;

  return (
    <section className="bbox-workspace">
      <header className="bbox-workspace__header">
        <div className="bbox-workspace__title-wrap">
          <h2 className="bbox-workspace__title">Bounding Box Workspace</h2>
          <p className="bbox-workspace__status">{p_workspace.pt_statusMessage}</p>
        </div>
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

        <div className="bbox-workspace__category-editor">
          <input
            type="text"
            value={p_workspace.pt_categoryDraftName}
            onChange={(p_event) => p_workspace.im_setCategoryDraftName(p_event.currentTarget.value)}
            onKeyDown={(p_event) => {
              if (p_event.key !== "Enter") return;
              p_event.preventDefault();
              p_workspace.im_addCategory();
            }}
            placeholder="새 카테고리"
            maxLength={30}
          />
          <button type="button" onClick={() => p_workspace.im_addCategory()}>
            카테고리 추가
          </button>
          <button
            type="button"
            className="bbox-workspace__danger"
            disabled={
              p_workspace.pt_labelCategories.length <= 1 || p_workspace.pt_selectedCategoryUsageCount > 0
            }
            onClick={() => p_workspace.im_deleteSelectedCategory()}
          >
            선택 카테고리 삭제
          </button>
        </div>

      </div>

      {p_workspace.pt_categoryStatusMessage && (
        <p className="bbox-workspace__category-message">{p_workspace.pt_categoryStatusMessage}</p>
      )}

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
          <strong>단축키 안내</strong>
        </p>
        <p>
          <strong>드로잉:</strong> 빈 영역 드래그
        </p>
        <p>
          <strong>겹쳐 그리기:</strong> <kbd>Shift</kbd> + 드래그
        </p>
        <p>
          <strong>박스 이동:</strong> 박스 내부 드래그
        </p>
        <p>
          <strong>박스 리사이즈:</strong> 선택 박스 핸들 드래그
        </p>
        <p>
          <strong>박스 삭제:</strong> <kbd>Delete</kbd>
        </p>
        <p>
          <strong>확대/축소:</strong> 마우스 휠
        </p>
      </div>
    </section>
  );
}
