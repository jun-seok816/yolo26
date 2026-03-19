import type React from "react";

export type ImageLabelerImage =
  | string
  | {
      id?: string;
      src: string;
      name?: string;
      alt?: string;
    };

export type ImageLabelerBoxInput = {
  id?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
};

export type ImageLabelerBoxOutput = {
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

export type ImageLabelerResolvedImage = {
  id: string;
  src: string;
  name: string;
};

export type ImageLabelerChange = {
  image: ImageLabelerResolvedImage | null;
  imageId: string | null;
  value: ImageLabelerBoxOutput[];
  categories: string[];
  selectedBoxId: string | null;
  naturalSize: {
    width: number;
    height: number;
  };
};

export type ImageLabelerProps = {
  image?: ImageLabelerImage | null;
  value?: readonly ImageLabelerBoxInput[];
  categories?: readonly string[];
  onChange?: (p_payload: ImageLabelerChange) => void;
  className?: string;
  style?: React.CSSProperties;
};
