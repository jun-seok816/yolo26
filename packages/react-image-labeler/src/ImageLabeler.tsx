import React, { useEffect, useState } from "react";
import BoundingBoxBoxList from "./internal/BoundingBoxBoxList.js";
import BoundingBoxWorkspace from "./internal/BoundingBoxWorkspace.js";
import { ImageLabelerController } from "./internal/ImageLabelerController.js";
import type { ImageLabelerProps } from "./ImageLabeler.types.js";

export type {
  ImageLabelerBoxInput,
  ImageLabelerBoxOutput,
  ImageLabelerChange,
  ImageLabelerImage,
  ImageLabelerProps,
  ImageLabelerResolvedImage,
} from "./ImageLabeler.types.js";

export default function ImageLabeler({
  image = null,
  value = [],
  categories = [],
  onChange,
  className,
  style,
}: ImageLabelerProps) {
  const [, setRenderTick] = useState(0);
  const [lv_changeTick, setChangeTick] = useState(0);
  const [lv_controller] = useState(
    () =>
      new ImageLabelerController((p_shouldEmitChange = true) => {
        setRenderTick((p_prev) => p_prev + 1);
        if (p_shouldEmitChange) {
          setChangeTick((p_prev) => p_prev + 1);
        }
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
  }, [lv_changeTick, lv_controller, onChange]);

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
