import React, { useEffect, useState } from "react";
import BoundingBoxWorkspace from "../BoundingBoxWorkspace";
import {
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

type BoundingBoxWorkspaceModuleProps = {
  p_image?: BoundingBoxWorkspaceModuleImage | null;
  p_images?: readonly BoundingBoxWorkspaceModuleImage[];
};

const gf_getFallbackRelativePath = (p_src: string, p_index: number) => {
  const lv_src = p_src.trim();
  if (!lv_src) return `prop_image_${p_index + 1}`;

  const lv_withoutHash = lv_src.split("#")[0] || "";
  const lv_withoutQuery = lv_withoutHash.split("?")[0] || "";
  const lv_fileName = lv_withoutQuery.split("/").filter((p_segment) => p_segment.length > 0).pop();
  return lv_fileName && lv_fileName.length > 0 ? lv_fileName : `prop_image_${p_index + 1}`;
};

const gf_normalizeModuleImages = (
  p_images: readonly BoundingBoxWorkspaceModuleImage[]
): BoundingBoxWorkspaceImageItem[] => {
  return p_images
    .map((p_image, p_index) => {
      if (typeof p_image === "string") {
        const lv_url = p_image.trim();
        if (!lv_url) return null;

        const lv_relativePath = gf_getFallbackRelativePath(lv_url, p_index);
        return {
          id: `prop_image_${p_index}_${lv_relativePath}`,
          relativePath: lv_relativePath,
          url: lv_url,
        };
      }

      const lv_url = p_image.src.trim();
      if (!lv_url) return null;

      const lv_relativePath = p_image.relativePath?.trim() || gf_getFallbackRelativePath(lv_url, p_index);
      const lv_id = p_image.id?.trim() || `prop_image_${p_index}_${lv_relativePath}`;

      return {
        id: lv_id,
        relativePath: lv_relativePath,
        url: lv_url,
      };
    })
    .filter((p_image): p_image is BoundingBoxWorkspaceImageItem => p_image !== null);
};

export default function BoundingBoxWorkspaceModule({
  p_image = null,
  p_images,
}: BoundingBoxWorkspaceModuleProps) {
  const [, setRenderTick] = useState(0);
  const [lv_workspace] = useState(
    () =>
      new BoundingBoxWorkspaceData(() => {
        setRenderTick((p_prev) => p_prev + 1);
      })
  );

  useEffect(() => {
    return () => {
      lv_workspace.im_dispose();
    };
  }, [lv_workspace]);

  useEffect(() => {
    const lv_imageInputs = p_images || (p_image ? [p_image] : []);
    lv_workspace.im_setProvidedImages(gf_normalizeModuleImages(lv_imageInputs));
  }, [p_image, p_images, lv_workspace]);

  return <BoundingBoxWorkspace p_workspace={lv_workspace} p_shouldAutoLoadImageList={false} />;
}
