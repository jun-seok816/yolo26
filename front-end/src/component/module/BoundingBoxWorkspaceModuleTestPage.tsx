import React, { useEffect, useRef, useState } from "react";
import "./BoundingBoxWorkspaceModuleTestPage.scss";
import ImageLabeler, {
  type ImageLabelerBoxInput,
  type ImageLabelerChange,
  type ImageLabelerImage,
} from "../../../../packages/react-image-labeler/src";
import "../../../../packages/react-image-labeler/src/style.css";

const gf_isImageFile = (p_file: File) => p_file.type.startsWith("image/");

export default function BoundingBoxWorkspaceModuleTestPage() {
  const [lv_image, setImage] = useState<ImageLabelerImage | null>(null);
  const [lv_value, setValue] = useState<ImageLabelerBoxInput[]>([]);
  const [lv_categories, setCategories] = useState<string[]>(["fish", "other"]);
  const [lv_labelState, setLabelState] = useState<ImageLabelerChange | null>(null);
  const [lv_statusMessage, setStatusMessage] = useState(
    "디버깅할 이미지 한 장을 선택하면 npm 패키지 형태의 ImageLabeler가 아래에 렌더됩니다."
  );
  const lv_objectUrlRef = useRef<string | null>(null);

  const lf_revokeObjectUrl = () => {
    if (!lv_objectUrlRef.current) return;
    URL.revokeObjectURL(lv_objectUrlRef.current);
    lv_objectUrlRef.current = null;
  };

  useEffect(() => {
    return () => {
      lf_revokeObjectUrl();
    };
  }, []);

  const lf_applyFiles = (p_files: File[]) => {
    lf_revokeObjectUrl();

    const lv_imageFile = p_files.find(gf_isImageFile);
    if (!lv_imageFile) {
      setImage(null);
      setValue([]);
      setCategories(["fish", "other"]);
      setLabelState(null);
      setStatusMessage("선택된 이미지가 없습니다. png/jpg/webp 등의 파일을 선택해주세요.");
      return;
    }

    const lv_url = URL.createObjectURL(lv_imageFile);
    lv_objectUrlRef.current = lv_url;

    const lv_nextImage = {
      id: `test_image_${lv_imageFile.name}_${lv_imageFile.lastModified}`,
      src: lv_url,
      name: lv_imageFile.name,
    } satisfies ImageLabelerImage;

    setImage(lv_nextImage);
    setValue([]);
    setCategories(["fish", "other"]);
    setStatusMessage(`props 이미지 1개를 모듈에 전달했습니다. (${lv_imageFile.name})`);
  };

  const lf_handleFileInputChange = (p_event: React.ChangeEvent<HTMLInputElement>) => {
    lf_applyFiles(Array.from(p_event.currentTarget.files || []));
    p_event.currentTarget.value = "";
  };

  const lf_clearImages = () => {
    lf_revokeObjectUrl();
    setImage(null);
    setValue([]);
    setCategories(["fish", "other"]);
    setLabelState(null);
    setStatusMessage("디버깅용 이미지를 비웠습니다.");
  };

  return (
    <section className="bbox-module-test">
      <header className="bbox-module-test__header">
        <div>
          <h1 className="bbox-module-test__title">Bounding Box Module Test</h1>
          <p className="bbox-module-test__description">{lv_statusMessage}</p>
        </div>
      </header>

      <section className="bbox-module-test__panel">
        <div className="bbox-module-test__controls">
          <label className="bbox-module-test__file-button">
            <input type="file" accept="image/*" onChange={lf_handleFileInputChange} />
            이미지 선택
          </label>
          <button type="button" onClick={lf_clearImages} disabled={!lv_image}>
            선택 초기화
          </button>
          <span className="bbox-module-test__meta">현재 props 이미지: {lv_image ? "1개" : "0개"}</span>
        </div>

        {lv_image && (
          <ul className="bbox-module-test__image-list">
            <li>{typeof lv_image === "string" ? lv_image : lv_image.name || lv_image.src}</li>
          </ul>
        )}
      </section>

      <div className="bbox-module-test__workspace">
        <ImageLabeler
          image={lv_image}
          value={lv_value}
          categories={lv_categories}
          onChange={(p_payload) => {
            setLabelState(p_payload);
            setCategories(p_payload.categories);
            setValue(
              p_payload.value.map((p_box) => ({
                id: p_box.id,
                label: p_box.label,
                x: p_box.pixel.x,
                y: p_box.pixel.y,
                w: p_box.pixel.w,
                h: p_box.pixel.h,
              }))
            );
          }}
        />
      </div>

      <section className="bbox-module-test__panel">
        <h2 className="bbox-module-test__result-title">Returned Label State</h2>
        <pre className="bbox-module-test__payload">
          {JSON.stringify(lv_labelState, null, 2) || "null"}
        </pre>
      </section>
    </section>
  );
}
