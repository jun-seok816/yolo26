import React, { useEffect, useRef } from "react";
import { BoundingBoxWorkspaceData } from "./BoundingBoxWorkspaceData";

type BoundingBoxWorkspaceProps = {
  p_workspace: BoundingBoxWorkspaceData;
};

export default function BoundingBoxWorkspace({ p_workspace }: BoundingBoxWorkspaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  return (
    <section className="bbox-workspace">
      <header className="bbox-workspace__header">
        <div className="bbox-workspace__title-wrap">
          <h2 className="bbox-workspace__title">Image Labeler</h2>
          <p className="bbox-workspace__status">{p_workspace.pt_statusMessage}</p>
        </div>
      </header>

      <div className="bbox-workspace__toolbar">
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
            placeholder="New category"
            maxLength={30}
          />
          <button type="button" onClick={() => p_workspace.im_addCategory()}>
            Add category
          </button>
          <button
            type="button"
            className="bbox-workspace__danger"
            disabled={
              p_workspace.pt_labelCategories.length <= 1 || p_workspace.pt_selectedCategoryUsageCount > 0
            }
            onClick={() => p_workspace.im_deleteSelectedCategory()}
          >
            Delete selected category
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
        {p_workspace.pt_isLoadingImage && <div className="bbox-workspace__loading">Loading image...</div>}
      </div>

      <div className="bbox-workspace__meta-grid">
        <p>
          <strong>Guide</strong>
        </p>
        <p>
          <strong>Draw:</strong> Drag on empty space
        </p>
        <p>
          <strong>Overlap draw:</strong> <kbd>Shift</kbd> + drag
        </p>
        <p>
          <strong>Overlap pick:</strong> <kbd>Alt</kbd> + click
        </p>
        <p>
          <strong>Move:</strong> Drag inside box
        </p>
        <p>
          <strong>Resize:</strong> Drag selected handles
        </p>
        <p>
          <strong>Delete:</strong> <kbd>Delete</kbd>
        </p>
        <p>
          <strong>Zoom:</strong> Mouse wheel
        </p>
      </div>
    </section>
  );
}
