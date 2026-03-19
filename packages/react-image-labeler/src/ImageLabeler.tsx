import React, { useEffect, useState } from "react";
import BoundingBoxBoxList from "./internal/BoundingBoxBoxList";
import BoundingBoxWorkspace from "./internal/BoundingBoxWorkspace";
import { ImageLabelerController } from "./internal/ImageLabelerController";
import type { ImageLabelerProps } from "./ImageLabeler.types";

export type {
  ImageLabelerBoxInput,
  ImageLabelerBoxOutput,
  ImageLabelerChange,
  ImageLabelerImage,
  ImageLabelerProps,
  ImageLabelerResolvedImage,
} from "./ImageLabeler.types";

export default function ImageLabeler({
  image = null,
  value = [],
  categories = [],
  onChange,
  className,
  style,
}: ImageLabelerProps) {
  const [lv_renderTick, setRenderTick] = useState(0);
  const [lv_controller] = useState(
    () =>
      new ImageLabelerController(() => {
        setRenderTick((p_prev) => p_prev + 1);
      })
  );
  const lv_workspace = lv_controller.pt_workspace;
  const lv_rootClassName = ["image-labeler", className].filter(Boolean).join(" ");

  useEffect(() => {
    return () => {
      lv_controller.im_dispose();
    };
  }, [lv_controller]);

  useEffect(() => {
    lv_controller.im_applyExternalState({ image, value, categories });
  }, [image, value, categories, lv_controller]);

  useEffect(() => {
    lv_controller.im_emitChange(onChange);
  }, [lv_renderTick, lv_controller, onChange]);

  return (
    <div className={lv_rootClassName} style={style}>
      <aside className="image-labeler__aside">
        <BoundingBoxBoxList p_workspace={lv_workspace} />
      </aside>
      <div className="image-labeler__main">
        <BoundingBoxWorkspace p_workspace={lv_workspace} />
      </div>
    </div>
  );
}
