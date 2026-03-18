import React from "react";
import ImageLabeler, {
  type ImageLabelerBoxInput,
  type ImageLabelerBoxOutput,
  type ImageLabelerChange,
  type ImageLabelerImage,
} from "@junseok816/react-image-labeler";
import "@junseok816/react-image-labeler/style.css";

export type BoundingBoxWorkspaceModuleImage =
  | string
  | {
      id?: string;
      src: string;
      relativePath?: string;
    };

export type BoundingBoxWorkspaceModuleBoxInput = ImageLabelerBoxInput;

export type BoundingBoxWorkspaceModuleBoxOutput = ImageLabelerBoxOutput;

export type BoundingBoxWorkspaceModuleChange = {
  image:
    | {
        id: string;
        relativePath: string;
        url: string;
      }
    | null;
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

const gf_normalizeModuleImage = (
  p_image: BoundingBoxWorkspaceModuleImage | null
): ImageLabelerImage | null => {
  if (!p_image) return null;
  if (typeof p_image === "string") return p_image;

  return {
    id: p_image.id,
    src: p_image.src,
    name: p_image.relativePath,
  };
};

const gf_buildModuleChangePayload = (p_payload: ImageLabelerChange): BoundingBoxWorkspaceModuleChange => {
  return {
    image: p_payload.image
      ? {
          id: p_payload.image.id,
          relativePath: p_payload.image.name,
          url: p_payload.image.src,
        }
      : null,
    boxes: p_payload.value,
    categories: p_payload.categories,
    selectedBoxId: p_payload.selectedBoxId,
    naturalSize: p_payload.naturalSize,
  };
};

export default function BoundingBoxWorkspaceModule({
  p_image = null,
  p_boxes = [],
  p_categories = [],
  p_onChange,
}: BoundingBoxWorkspaceModuleProps) {
  return (
    <ImageLabeler
      image={gf_normalizeModuleImage(p_image)}
      value={p_boxes}
      categories={p_categories}
      onChange={(p_payload) => {
        if (!p_onChange) return;
        p_onChange(gf_buildModuleChangePayload(p_payload));
      }}
    />
  );
}
