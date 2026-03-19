import type {
  ImageLabelerBoxInput,
  ImageLabelerChange,
  ImageLabelerImage,
} from "../ImageLabeler.types";
import {
  type BoundingBox,
  BoundingBoxWorkspaceData,
  type BoundingBoxWorkspaceImageItem,
} from "./BoundingBoxWorkspaceData";

type ImageLabelerExternalState = {
  image: ImageLabelerImage | null;
  value: readonly ImageLabelerBoxInput[];
  categories: readonly string[];
};

export class ImageLabelerController {
  private readonly iv_workspace: BoundingBoxWorkspaceData;
  private iv_lastEmittedPayloadSignature = "";
  private iv_lastEmittedExternalStateSignature = "";
  private iv_lastAppliedExternalSignature = "";

  constructor(p_onWorkspaceChange: () => void = () => {}) {
    this.iv_workspace = new BoundingBoxWorkspaceData(p_onWorkspaceChange);
  }

  public get pt_workspace() {
    return this.iv_workspace;
  }

  public im_dispose() {
    this.iv_workspace.im_dispose();
  }

  public im_applyExternalState({ image, value, categories }: ImageLabelerExternalState) {
    const lv_normalizedImage = this.im_normalizeImage(image);
    const lv_normalizedValue = this.im_normalizeValue(value);
    const lv_normalizedCategories = this.im_normalizeCategories(categories);
    const lv_externalStateSignature = this.im_buildExternalStateSignature(
      lv_normalizedImage,
      lv_normalizedValue,
      lv_normalizedCategories
    );

    this.iv_workspace.im_setProvidedImages(lv_normalizedImage ? [lv_normalizedImage] : []);

    if (lv_externalStateSignature === this.iv_lastAppliedExternalSignature) return;
    if (lv_externalStateSignature === this.iv_lastEmittedExternalStateSignature) return;

    this.iv_lastAppliedExternalSignature = lv_externalStateSignature;
    this.iv_workspace.im_setProvidedCurrentImageLabelState(lv_normalizedValue, [...lv_normalizedCategories]);
  }

  public im_emitChange(p_onChange?: (p_payload: ImageLabelerChange) => void) {
    if (!p_onChange) return;

    const lv_payload = this.im_buildChangePayload(this.iv_workspace);
    const lv_payloadSignature = JSON.stringify(lv_payload);
    if (lv_payloadSignature === this.iv_lastEmittedPayloadSignature) return;

    this.iv_lastEmittedPayloadSignature = lv_payloadSignature;
    this.iv_lastEmittedExternalStateSignature = this.im_buildWorkspaceExternalStateSignature(this.iv_workspace);
    p_onChange(lv_payload);
  }

  private im_getFallbackImageName(p_src: string) {
    const lv_src = p_src.trim();
    if (!lv_src) return "image";

    const lv_withoutHash = lv_src.split("#")[0] || "";
    const lv_withoutQuery = lv_withoutHash.split("?")[0] || "";
    const lv_fileName = lv_withoutQuery.split("/").filter((p_segment) => p_segment.length > 0).pop();
    return lv_fileName && lv_fileName.length > 0 ? lv_fileName : "image";
  }

  private im_normalizeImage(p_image: ImageLabelerImage | null): BoundingBoxWorkspaceImageItem | null {
    if (!p_image) return null;

    if (typeof p_image === "string") {
      const lv_url = p_image.trim();
      if (!lv_url) return null;

      const lv_name = this.im_getFallbackImageName(lv_url);
      return {
        id: `image_${lv_name}`,
        relativePath: lv_name,
        url: lv_url,
      };
    }

    const lv_url = p_image.src.trim();
    if (!lv_url) return null;

    const lv_name = p_image.name?.trim() || this.im_getFallbackImageName(lv_url);
    const lv_id = p_image.id?.trim() || `image_${lv_name}`;
    return {
      id: lv_id,
      relativePath: lv_name,
      url: lv_url,
    };
  }

  private im_normalizeValue(p_value: readonly ImageLabelerBoxInput[]): BoundingBox[] {
    return p_value
      .map((p_box, p_index) => {
        const lv_label = p_box.label.trim();
        if (!lv_label) return null;

        return {
          id: p_box.id?.trim() || `box_${p_index + 1}`,
          x: p_box.x,
          y: p_box.y,
          w: p_box.w,
          h: p_box.h,
          label: lv_label,
        } satisfies BoundingBox;
      })
      .filter((p_box): p_box is BoundingBox => p_box !== null);
  }

  private im_normalizeCategories(p_categories: readonly string[]) {
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
  }

  private im_buildExternalStateSignature(
    p_image: BoundingBoxWorkspaceImageItem | null,
    p_value: readonly BoundingBox[],
    p_categories: readonly string[]
  ) {
    return JSON.stringify({
      image: p_image,
      value: p_value.map((p_box) => ({
        id: p_box.id,
        x: p_box.x,
        y: p_box.y,
        w: p_box.w,
        h: p_box.h,
        label: p_box.label,
      })),
      categories: [...p_categories],
    });
  }

  private im_buildWorkspaceExternalStateSignature(p_workspace: BoundingBoxWorkspaceData) {
    return this.im_buildExternalStateSignature(
      p_workspace.pt_currentImage,
      p_workspace.pt_currentBoxes,
      p_workspace.pt_labelCategories
    );
  }

  private im_buildChangePayload(p_workspace: BoundingBoxWorkspaceData): ImageLabelerChange {
    const lv_currentImage = p_workspace.pt_currentImage;
    const lv_naturalSize = p_workspace.pt_naturalSize;
    const lv_value = p_workspace.pt_currentBoxes.map((p_box) => {
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
            src: lv_currentImage.url,
            name: lv_currentImage.relativePath,
          }
        : null,
      imageId: lv_currentImage?.id || null,
      value: lv_value,
      categories: [...p_workspace.pt_labelCategories],
      selectedBoxId: p_workspace.pt_selectedBoxId,
      naturalSize: {
        width: lv_naturalSize.width,
        height: lv_naturalSize.height,
      },
    };
  }
}
