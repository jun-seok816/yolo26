import React, { useEffect, useRef, useState } from "react";
import "./BoundingBoxWorkspaceModule.scss";
import BoundingBoxWorkspace from "../BoundingBoxWorkspace";
import BoundingBoxBoxList from "./BoundingBoxBoxList";
import {
  type BoundingBox,
  BoundingBoxWorkspaceData,
  type BoundingBoxWorkspaceImageItem,
} from "@jsLib/class/BoundingBoxWorkspaceData";

export type BoundingBoxWorkspaceModuleImage =
  | string
  | {
      id?: string;
      src: string;
      relativePath?: string;
    };

export type BoundingBoxWorkspaceModuleBoxInput = {
  id?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
};

export type BoundingBoxWorkspaceModuleBoxOutput = {
  id: string;
  label: string;
  pixel: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  normalized: {
    cx: number;
    cy: number;
    w: number;
    h: number;
  };
};

export type BoundingBoxWorkspaceModuleChange = {
  image: BoundingBoxWorkspaceImageItem | null;
  boxes: BoundingBoxWorkspaceModuleBoxOutput[];
  categories: string[];
  selectedBoxId: string | null;
  naturalSize: {
    width: number;
    height: number;
  };
};

type BoundingBoxWorkspaceModuleProps = {
  p_image?: BoundingBoxWorkspaceModuleImage | null;
  p_boxes?: readonly BoundingBoxWorkspaceModuleBoxInput[];
  p_categories?: readonly string[];
  p_onChange?: (p_payload: BoundingBoxWorkspaceModuleChange) => void;
};

const gf_getFallbackRelativePath = (p_src: string) => {
  const lv_src = p_src.trim();
  if (!lv_src) return "prop_image";

  const lv_withoutHash = lv_src.split("#")[0] || "";
  const lv_withoutQuery = lv_withoutHash.split("?")[0] || "";
  const lv_fileName = lv_withoutQuery.split("/").filter((p_segment) => p_segment.length > 0).pop();
  return lv_fileName && lv_fileName.length > 0 ? lv_fileName : "prop_image";
};

const gf_normalizeModuleImage = (
  p_image: BoundingBoxWorkspaceModuleImage | null
): BoundingBoxWorkspaceImageItem | null => {
  if (!p_image) return null;

  if (typeof p_image === "string") {
    const lv_url = p_image.trim();
    if (!lv_url) return null;

    const lv_relativePath = gf_getFallbackRelativePath(lv_url);
    return {
      id: `prop_image_${lv_relativePath}`,
      relativePath: lv_relativePath,
      url: lv_url,
    };
  }

  const lv_url = p_image.src.trim();
  if (!lv_url) return null;

  const lv_relativePath = p_image.relativePath?.trim() || gf_getFallbackRelativePath(lv_url);
  const lv_id = p_image.id?.trim() || `prop_image_${lv_relativePath}`;

  return {
    id: lv_id,
    relativePath: lv_relativePath,
    url: lv_url,
  };
};

const gf_normalizeModuleBoxes = (p_boxes: readonly BoundingBoxWorkspaceModuleBoxInput[]): BoundingBox[] => {
  return p_boxes
    .map((p_box, p_index) => {
      const lv_label = p_box.label.trim();
      if (!lv_label) return null;

      return {
        id: p_box.id?.trim() || `prop_box_${p_index + 1}`,
        x: p_box.x,
        y: p_box.y,
        w: p_box.w,
        h: p_box.h,
        label: lv_label,
      } satisfies BoundingBox;
    })
    .filter((p_box): p_box is BoundingBox => p_box !== null);
};

const gf_normalizeModuleCategories = (p_categories: readonly string[]) => {
  const lv_seen = new Set<string>();
  const lv_categories: string[] = [];

  p_categories.forEach((p_category) => {
    const lv_name = p_category.trim();
    if (!lv_name) return;

    const lv_key = lv_name.toLowerCase();
    if (lv_seen.has(lv_key)) return;
    lv_seen.add(lv_key);
    lv_categories.push(lv_name);
  });

  return lv_categories;
};

const gf_buildExternalStateSignature = (
  p_image: BoundingBoxWorkspaceImageItem | null,
  p_boxes: readonly BoundingBox[],
  p_categories: readonly string[]
) => {
  return JSON.stringify({
    image: p_image,
    boxes: p_boxes.map((p_box) => ({
      id: p_box.id,
      x: p_box.x,
      y: p_box.y,
      w: p_box.w,
      h: p_box.h,
      label: p_box.label,
    })),
    categories: [...p_categories],
  });
};

const gf_buildChangePayload = (p_workspace: BoundingBoxWorkspaceData): BoundingBoxWorkspaceModuleChange => {
  const lv_currentImage = p_workspace.pt_currentImage;
  const lv_naturalSize = p_workspace.pt_naturalSize;
  const lv_boxes = p_workspace.pt_currentBoxes.map((p_box) => {
    const lv_canNormalize = lv_naturalSize.width > 0 && lv_naturalSize.height > 0;

    return {
      id: p_box.id,
      label: p_box.label,
      pixel: {
        x: p_box.x,
        y: p_box.y,
        w: p_box.w,
        h: p_box.h,
      },
      normalized: {
        cx: lv_canNormalize ? (p_box.x + p_box.w / 2) / lv_naturalSize.width : 0,
        cy: lv_canNormalize ? (p_box.y + p_box.h / 2) / lv_naturalSize.height : 0,
        w: lv_canNormalize ? p_box.w / lv_naturalSize.width : 0,
        h: lv_canNormalize ? p_box.h / lv_naturalSize.height : 0,
      },
    };
  });

  return {
    image: lv_currentImage
      ? {
          id: lv_currentImage.id,
          relativePath: lv_currentImage.relativePath,
          url: lv_currentImage.url,
        }
      : null,
    boxes: lv_boxes,
    categories: [...p_workspace.pt_labelCategories],
    selectedBoxId: p_workspace.pt_selectedBoxId,
    naturalSize: {
      width: lv_naturalSize.width,
      height: lv_naturalSize.height,
    },
  };
};

export default function BoundingBoxWorkspaceModule({
  p_image = null,
  p_boxes = [],
  p_categories = [],
  p_onChange,
}: BoundingBoxWorkspaceModuleProps) {
  const [lv_renderTick, setRenderTick] = useState(0);
  const lv_lastEmittedSignatureRef = useRef("");
  const lv_lastAppliedExternalSignatureRef = useRef("");
  const [lv_workspace] = useState(
    () =>
      new BoundingBoxWorkspaceData(() => {
        setRenderTick((p_prev) => p_prev + 1);
      })
  );
  const lv_normalizedImage = gf_normalizeModuleImage(p_image);
  const lv_normalizedBoxes = gf_normalizeModuleBoxes(p_boxes);
  const lv_normalizedCategories = gf_normalizeModuleCategories(p_categories);
  const lv_externalStateSignature = gf_buildExternalStateSignature(
    lv_normalizedImage,
    lv_normalizedBoxes,
    lv_normalizedCategories
  );

  useEffect(() => {
    return () => {
      lv_workspace.im_dispose();
    };
  }, [lv_workspace]);

  useEffect(() => {
    lv_workspace.im_setProvidedImages(lv_normalizedImage ? [lv_normalizedImage] : []);
  }, [lv_normalizedImage, lv_workspace]);

  useEffect(() => {
    if (lv_externalStateSignature === lv_lastAppliedExternalSignatureRef.current) return;
    if (lv_externalStateSignature === lv_lastEmittedSignatureRef.current) return;

    lv_lastAppliedExternalSignatureRef.current = lv_externalStateSignature;
    lv_workspace.im_setProvidedCurrentImageLabelState(lv_normalizedBoxes, [...lv_normalizedCategories]);
  }, [lv_externalStateSignature, lv_normalizedBoxes, lv_normalizedCategories, lv_workspace]);

  useEffect(() => {
    if (!p_onChange) return;

    const lv_payload = gf_buildChangePayload(lv_workspace);
    const lv_payloadSignature = JSON.stringify(lv_payload);
    if (lv_payloadSignature === lv_lastEmittedSignatureRef.current) return;

    lv_lastEmittedSignatureRef.current = lv_payloadSignature;
    p_onChange(lv_payload);
  }, [lv_renderTick, lv_workspace, p_onChange]);

  return (
    <div className="bbox-module">
      <aside className="bbox-module__aside">
        <BoundingBoxBoxList p_workspace={lv_workspace} />
      </aside>
      <div className="bbox-module__main">
        <BoundingBoxWorkspace p_workspace={lv_workspace} p_shouldAutoLoadImageList={false} />
      </div>
    </div>
  );
}
