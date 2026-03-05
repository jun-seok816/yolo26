import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./BoundingBoxWorkspace.scss";

type RouterImageListResponse = {
  err?: boolean;
  images?: string[];
  msg?: string;
};

type RouterImageItem = {
  id: string;
  relativePath: string;
  url: string;
};

type BoundingBox = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
};

type DragState =
  | { mode: "idle" }
  | { mode: "drawing"; startX: number; startY: number }
  | { mode: "moving"; boxId: string; offsetX: number; offsetY: number };

const DEFAULT_LABEL = "object";
const MIN_BOX_SIZE = 4;
const MAX_CANVAS_WIDTH = 860;
const MAX_CANVAS_HEIGHT = 640;

const gf_clamp = (p_value: number, p_min: number, p_max: number) => {
  return Math.max(p_min, Math.min(p_value, p_max));
};

const gf_toImageUrl = (p_relativePath: string) => {
  return `/images/${p_relativePath
    .split("/")
    .filter((p_segment) => p_segment.length > 0)
    .map((p_segment) => encodeURIComponent(p_segment))
    .join("/")}`;
};

export default function BoundingBoxWorkspace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const dragStateRef = useRef<DragState>({ mode: "idle" });
  const boxSeqRef = useRef(1);

  const [lv_images, setImages] = useState<RouterImageItem[]>([]);
  const [lv_currentIndex, setCurrentIndex] = useState(0);
  const [lv_boxesByImage, setBoxesByImage] = useState<Record<string, BoundingBox[]>>({});
  const [lv_selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [lv_draftBox, setDraftBox] = useState<BoundingBox | null>(null);
  const [lv_isLoadingImage, setIsLoadingImage] = useState(false);
  const [lv_statusMessage, setStatusMessage] = useState("라우터 이미지 목록을 불러오는 중입니다.");
  const [lv_labelInput, setLabelInput] = useState(DEFAULT_LABEL);
  const [lv_naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

  const lv_currentImage = lv_images[lv_currentIndex] || null;
  const lv_currentBoxes = lv_currentImage ? lv_boxesByImage[lv_currentImage.id] || [] : [];
  const lv_selectedBox =
    lv_selectedBoxId && lv_currentBoxes.length > 0
      ? lv_currentBoxes.find((p_item) => p_item.id === lv_selectedBoxId) || null
      : null;

  const lv_canvasSize = useMemo(() => {
    if (lv_naturalSize.width <= 0 || lv_naturalSize.height <= 0) {
      return { width: 860, height: 500, scale: 1 };
    }

    const lv_scale = Math.min(
      MAX_CANVAS_WIDTH / lv_naturalSize.width,
      MAX_CANVAS_HEIGHT / lv_naturalSize.height,
      1
    );

    return {
      width: Math.max(1, Math.round(lv_naturalSize.width * lv_scale)),
      height: Math.max(1, Math.round(lv_naturalSize.height * lv_scale)),
      scale: lv_scale,
    };
  }, [lv_naturalSize.height, lv_naturalSize.width]);

  const lv_totalBoxCount = useMemo(() => {
    return Object.values(lv_boxesByImage).reduce((p_sum, p_items) => p_sum + p_items.length, 0);
  }, [lv_boxesByImage]);

  const lv_selectedBoxNormalized = useMemo(() => {
    if (!lv_selectedBox || lv_naturalSize.width <= 0 || lv_naturalSize.height <= 0) return null;

    const lv_centerX = (lv_selectedBox.x + lv_selectedBox.w / 2) / lv_naturalSize.width;
    const lv_centerY = (lv_selectedBox.y + lv_selectedBox.h / 2) / lv_naturalSize.height;
    const lv_width = lv_selectedBox.w / lv_naturalSize.width;
    const lv_height = lv_selectedBox.h / lv_naturalSize.height;

    return {
      cx: lv_centerX,
      cy: lv_centerY,
      w: lv_width,
      h: lv_height,
    };
  }, [lv_naturalSize.height, lv_naturalSize.width, lv_selectedBox]);

  const im_loadImageList = useCallback(async () => {
    setStatusMessage("라우터 이미지 목록을 불러오는 중입니다.");

    try {
      const lv_response = await fetch("/images/list");
      if (!lv_response.ok) {
        throw new Error(`image list http status ${lv_response.status}`);
      }

      const lv_payload = (await lv_response.json()) as RouterImageListResponse;
      const lv_rawImages = Array.isArray(lv_payload.images) ? lv_payload.images : [];
      const lv_nextImages: RouterImageItem[] = [];

      lv_rawImages.forEach((p_relativePath, p_index) => {
        const lv_normalized = p_relativePath.replace(/\\/g, "/").replace(/^\/+/, "").trim();
        if (!lv_normalized) return;

        lv_nextImages.push({
          id: `img_${p_index}_${lv_normalized}`,
          relativePath: lv_normalized,
          url: gf_toImageUrl(lv_normalized),
        });
      });

      setImages(lv_nextImages);
      setCurrentIndex(0);
      setBoxesByImage({});
      setSelectedBoxId(null);
      setDraftBox(null);
      setStatusMessage(
        lv_nextImages.length > 0
          ? `라우터에서 이미지 ${lv_nextImages.length}개를 불러왔습니다.`
          : "라우터 이미지가 비어 있습니다."
      );
    } catch (p_error) {
      console.error("[BoundingBoxWorkspace] image list load failed:", p_error);
      setImages([]);
      setCurrentIndex(0);
      setBoxesByImage({});
      setStatusMessage("이미지 목록 로드에 실패했습니다. /images/list 라우트를 확인해주세요.");
    }
  }, []);

  const im_updateCurrentBoxes = useCallback(
    (p_updater: (p_prevBoxes: BoundingBox[]) => BoundingBox[]) => {
      if (!lv_currentImage) return;

      setBoxesByImage((p_prev) => {
        const lv_prevBoxes = p_prev[lv_currentImage.id] || [];
        const lv_nextBoxes = p_updater(lv_prevBoxes);
        return {
          ...p_prev,
          [lv_currentImage.id]: lv_nextBoxes,
        };
      });
    },
    [lv_currentImage]
  );

  const im_getImagePointFromMouse = useCallback(
    (p_event: React.MouseEvent<HTMLCanvasElement>) => {
      const lv_canvas = canvasRef.current;
      if (!lv_canvas || lv_naturalSize.width <= 0 || lv_naturalSize.height <= 0) return null;

      const lv_rect = lv_canvas.getBoundingClientRect();
      if (lv_rect.width <= 0 || lv_rect.height <= 0) return null;

      const lv_canvasX = ((p_event.clientX - lv_rect.left) * lv_canvas.width) / lv_rect.width;
      const lv_canvasY = ((p_event.clientY - lv_rect.top) * lv_canvas.height) / lv_rect.height;

      return {
        x: gf_clamp(lv_canvasX / lv_canvasSize.scale, 0, lv_naturalSize.width),
        y: gf_clamp(lv_canvasY / lv_canvasSize.scale, 0, lv_naturalSize.height),
      };
    },
    [lv_canvasSize.scale, lv_naturalSize.height, lv_naturalSize.width]
  );

  const im_findHitBox = useCallback(
    (p_x: number, p_y: number): BoundingBox | null => {
      for (let lv_i = lv_currentBoxes.length - 1; lv_i >= 0; lv_i -= 1) {
        const lv_box = lv_currentBoxes[lv_i];
        if (
          p_x >= lv_box.x &&
          p_x <= lv_box.x + lv_box.w &&
          p_y >= lv_box.y &&
          p_y <= lv_box.y + lv_box.h
        ) {
          return lv_box;
        }
      }
      return null;
    },
    [lv_currentBoxes]
  );

  const im_drawScene = useCallback(() => {
    const lv_canvas = canvasRef.current;
    if (!lv_canvas) return;

    if (lv_canvas.width !== lv_canvasSize.width) lv_canvas.width = lv_canvasSize.width;
    if (lv_canvas.height !== lv_canvasSize.height) lv_canvas.height = lv_canvasSize.height;

    const lv_ctx = lv_canvas.getContext("2d");
    if (!lv_ctx) return;

    lv_ctx.clearRect(0, 0, lv_canvas.width, lv_canvas.height);

    const lv_loadedImage = loadedImageRef.current;
    if (!lv_loadedImage) {
      lv_ctx.fillStyle = "#1f232b";
      lv_ctx.fillRect(0, 0, lv_canvas.width, lv_canvas.height);
      lv_ctx.fillStyle = "#9ca8ba";
      lv_ctx.font = "16px Arial";
      lv_ctx.textAlign = "center";
      lv_ctx.textBaseline = "middle";
      lv_ctx.fillText("이미지를 선택하면 캔버스가 활성화됩니다.", lv_canvas.width / 2, lv_canvas.height / 2);
      return;
    }

    lv_ctx.drawImage(lv_loadedImage, 0, 0, lv_canvas.width, lv_canvas.height);

    lv_currentBoxes.forEach((p_box) => {
      const lv_x = p_box.x * lv_canvasSize.scale;
      const lv_y = p_box.y * lv_canvasSize.scale;
      const lv_w = p_box.w * lv_canvasSize.scale;
      const lv_h = p_box.h * lv_canvasSize.scale;
      const lv_isSelected = p_box.id === lv_selectedBoxId;

      lv_ctx.lineWidth = lv_isSelected ? 2.5 : 2;
      lv_ctx.strokeStyle = lv_isSelected ? "#ff9800" : "#6aa4ff";
      lv_ctx.fillStyle = lv_isSelected ? "rgba(255, 152, 0, 0.18)" : "rgba(106, 164, 255, 0.16)";
      lv_ctx.strokeRect(lv_x, lv_y, lv_w, lv_h);
      lv_ctx.fillRect(lv_x, lv_y, lv_w, lv_h);

      const lv_labelText = `${p_box.label} (${Math.round(p_box.w)}x${Math.round(p_box.h)})`;
      lv_ctx.font = "12px Arial";
      const lv_labelWidth = lv_ctx.measureText(lv_labelText).width;
      const lv_labelHeight = 18;
      const lv_labelY = Math.max(0, lv_y - lv_labelHeight);

      lv_ctx.fillStyle = lv_isSelected ? "rgba(255, 152, 0, 0.9)" : "rgba(33, 82, 177, 0.86)";
      lv_ctx.fillRect(lv_x, lv_labelY, lv_labelWidth + 12, lv_labelHeight);
      lv_ctx.fillStyle = "#ffffff";
      lv_ctx.textBaseline = "middle";
      lv_ctx.fillText(lv_labelText, lv_x + 6, lv_labelY + lv_labelHeight / 2);
    });

    if (lv_draftBox) {
      const lv_x = lv_draftBox.x * lv_canvasSize.scale;
      const lv_y = lv_draftBox.y * lv_canvasSize.scale;
      const lv_w = lv_draftBox.w * lv_canvasSize.scale;
      const lv_h = lv_draftBox.h * lv_canvasSize.scale;

      lv_ctx.setLineDash([7, 5]);
      lv_ctx.lineWidth = 2;
      lv_ctx.strokeStyle = "#f59e0b";
      lv_ctx.strokeRect(lv_x, lv_y, lv_w, lv_h);
      lv_ctx.setLineDash([]);
    }
  }, [lv_canvasSize.height, lv_canvasSize.scale, lv_canvasSize.width, lv_currentBoxes, lv_draftBox, lv_selectedBoxId]);

  const im_finishDrag = useCallback(
    (p_event: React.MouseEvent<HTMLCanvasElement>) => {
      const lv_drag = dragStateRef.current;
      if (lv_drag.mode === "idle") return;

      const lv_point = im_getImagePointFromMouse(p_event);
      if (!lv_point) {
        dragStateRef.current = { mode: "idle" };
        setDraftBox(null);
        return;
      }

      if (lv_drag.mode === "drawing") {
        const lv_x = Math.min(lv_drag.startX, lv_point.x);
        const lv_y = Math.min(lv_drag.startY, lv_point.y);
        const lv_w = Math.abs(lv_point.x - lv_drag.startX);
        const lv_h = Math.abs(lv_point.y - lv_drag.startY);

        if (lv_w >= MIN_BOX_SIZE && lv_h >= MIN_BOX_SIZE && lv_currentImage) {
          const lv_label = lv_labelInput.trim() || DEFAULT_LABEL;
          const lv_nextBoxId = `box_${boxSeqRef.current}`;
          boxSeqRef.current += 1;

          const lv_nextBox: BoundingBox = {
            id: lv_nextBoxId,
            x: lv_x,
            y: lv_y,
            w: lv_w,
            h: lv_h,
            label: lv_label,
          };

          im_updateCurrentBoxes((p_prevBoxes) => [...p_prevBoxes, lv_nextBox]);
          setSelectedBoxId(lv_nextBoxId);
        }

        setDraftBox(null);
      }

      dragStateRef.current = { mode: "idle" };
    },
    [im_getImagePointFromMouse, im_updateCurrentBoxes, lv_currentImage, lv_labelInput]
  );

  const im_handleMouseDown = (p_event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!lv_currentImage || !loadedImageRef.current) return;

    const lv_point = im_getImagePointFromMouse(p_event);
    if (!lv_point) return;

    const lv_hitBox = im_findHitBox(lv_point.x, lv_point.y);
    if (lv_hitBox) {
      setSelectedBoxId(lv_hitBox.id);
      dragStateRef.current = {
        mode: "moving",
        boxId: lv_hitBox.id,
        offsetX: lv_point.x - lv_hitBox.x,
        offsetY: lv_point.y - lv_hitBox.y,
      };
      return;
    }

    setSelectedBoxId(null);
    dragStateRef.current = { mode: "drawing", startX: lv_point.x, startY: lv_point.y };
    setDraftBox({
      id: "draft",
      x: lv_point.x,
      y: lv_point.y,
      w: 0,
      h: 0,
      label: lv_labelInput.trim() || DEFAULT_LABEL,
    });
  };

  const im_handleMouseMove = (p_event: React.MouseEvent<HTMLCanvasElement>) => {
    const lv_drag = dragStateRef.current;
    if (lv_drag.mode === "idle") return;

    const lv_point = im_getImagePointFromMouse(p_event);
    if (!lv_point) return;

    if (lv_drag.mode === "drawing") {
      const lv_x = Math.min(lv_drag.startX, lv_point.x);
      const lv_y = Math.min(lv_drag.startY, lv_point.y);
      const lv_w = Math.abs(lv_point.x - lv_drag.startX);
      const lv_h = Math.abs(lv_point.y - lv_drag.startY);

      setDraftBox({
        id: "draft",
        x: lv_x,
        y: lv_y,
        w: lv_w,
        h: lv_h,
        label: lv_labelInput.trim() || DEFAULT_LABEL,
      });
      return;
    }

    if (lv_drag.mode === "moving") {
      im_updateCurrentBoxes((p_prevBoxes) =>
        p_prevBoxes.map((p_box) => {
          if (p_box.id !== lv_drag.boxId) return p_box;

          const lv_nextX = gf_clamp(
            lv_point.x - lv_drag.offsetX,
            0,
            Math.max(0, lv_naturalSize.width - p_box.w)
          );
          const lv_nextY = gf_clamp(
            lv_point.y - lv_drag.offsetY,
            0,
            Math.max(0, lv_naturalSize.height - p_box.h)
          );

          return {
            ...p_box,
            x: lv_nextX,
            y: lv_nextY,
          };
        })
      );
    }
  };

  useEffect(() => {
    im_loadImageList();
  }, [im_loadImageList]);

  useEffect(() => {
    dragStateRef.current = { mode: "idle" };
    setDraftBox(null);
    setSelectedBoxId(null);

    if (!lv_currentImage) {
      loadedImageRef.current = null;
      setNaturalSize({ width: 0, height: 0 });
      return;
    }

    setIsLoadingImage(true);
    setStatusMessage(`이미지 로딩 중: ${lv_currentImage.relativePath}`);

    const lv_image = new Image();
    let lv_isCanceled = false;

    lv_image.onload = () => {
      if (lv_isCanceled) return;
      loadedImageRef.current = lv_image;
      setNaturalSize({
        width: lv_image.naturalWidth,
        height: lv_image.naturalHeight,
      });
      setIsLoadingImage(false);
      setStatusMessage(
        `이미지 ${lv_currentIndex + 1}/${lv_images.length} - ${lv_currentImage.relativePath}`
      );
    };

    lv_image.onerror = () => {
      if (lv_isCanceled) return;
      loadedImageRef.current = null;
      setNaturalSize({ width: 0, height: 0 });
      setIsLoadingImage(false);
      setStatusMessage(`이미지 로드 실패: ${lv_currentImage.relativePath}`);
    };

    lv_image.src = lv_currentImage.url;

    return () => {
      lv_isCanceled = true;
    };
  }, [lv_currentImage, lv_currentIndex, lv_images.length]);

  useEffect(() => {
    im_drawScene();
  }, [im_drawScene]);

  return (
    <section className="bbox-workspace">
      <header className="bbox-workspace__header">
        <div className="bbox-workspace__title-wrap">
          <h2 className="bbox-workspace__title">Bounding Box Workspace</h2>
          <p className="bbox-workspace__status">{lv_statusMessage}</p>
        </div>
        <button type="button" className="bbox-workspace__refresh" onClick={im_loadImageList}>
          이미지 목록 새로고침
        </button>
      </header>

      <div className="bbox-workspace__toolbar">
        <div className="bbox-workspace__pager">
          <button
            type="button"
            disabled={lv_images.length === 0 || lv_currentIndex <= 0}
            onClick={() => setCurrentIndex((p_prev) => Math.max(0, p_prev - 1))}
          >
            이전
          </button>
          <span>
            {lv_images.length === 0 ? "0 / 0" : `${lv_currentIndex + 1} / ${lv_images.length}`}
          </span>
          <button
            type="button"
            disabled={lv_images.length === 0 || lv_currentIndex >= lv_images.length - 1}
            onClick={() =>
              setCurrentIndex((p_prev) => Math.min(Math.max(0, lv_images.length - 1), p_prev + 1))
            }
          >
            다음
          </button>
        </div>

        <label className="bbox-workspace__label-input">
          Label
          <input
            type="text"
            value={lv_labelInput}
            onChange={(p_event) => setLabelInput(p_event.currentTarget.value)}
            placeholder="object"
            maxLength={40}
          />
        </label>

        <button
          type="button"
          className="bbox-workspace__danger"
          disabled={!lv_selectedBoxId}
          onClick={() => {
            if (!lv_selectedBoxId) return;
            im_updateCurrentBoxes((p_prevBoxes) =>
              p_prevBoxes.filter((p_item) => p_item.id !== lv_selectedBoxId)
            );
            setSelectedBoxId(null);
          }}
        >
          선택 박스 삭제
        </button>

        <button
          type="button"
          disabled={lv_currentBoxes.length === 0}
          onClick={() => {
            im_updateCurrentBoxes(() => []);
            setSelectedBoxId(null);
          }}
        >
          현재 이미지 박스 전체 삭제
        </button>
      </div>

      <div className="bbox-workspace__canvas-wrap">
        <canvas
          ref={canvasRef}
          className="bbox-workspace__canvas"
          onMouseDown={im_handleMouseDown}
          onMouseMove={im_handleMouseMove}
          onMouseUp={im_finishDrag}
          onMouseLeave={(p_event) => {
            im_finishDrag(p_event);
            dragStateRef.current = { mode: "idle" };
          }}
        />
        {lv_isLoadingImage && <div className="bbox-workspace__loading">이미지 로딩 중...</div>}
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
          <strong>박스 수:</strong> 현재 {lv_currentBoxes.length}개 / 전체 {lv_totalBoxCount}개
        </p>
        <p>
          <strong>작업 가이드:</strong> 드래그로 박스 생성, 박스 내부 드래그로 이동
        </p>
        {lv_selectedBox && (
          <p className="bbox-workspace__meta-highlight">
            <strong>선택 박스(px):</strong> x={lv_selectedBox.x.toFixed(1)} y=
            {lv_selectedBox.y.toFixed(1)} w={lv_selectedBox.w.toFixed(1)} h=
            {lv_selectedBox.h.toFixed(1)}
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
