import React, { useEffect, useRef, useState } from "react";
import "./BoundingBoxWorkspaceModuleTestPage.scss";
import BoundingBoxWorkspaceModule, {
  type BoundingBoxWorkspaceModuleImage,
} from "./BoundingBoxWorkspaceModule";

const gf_isImageFile = (p_file: File) => p_file.type.startsWith("image/");

export default function BoundingBoxWorkspaceModuleTestPage() {
  const [lv_images, setImages] = useState<BoundingBoxWorkspaceModuleImage[]>([]);
  const [lv_statusMessage, setStatusMessage] = useState(
    "디버깅할 이미지를 선택하면 props 기반 Bounding Box 모듈이 아래에 렌더됩니다."
  );
  const lv_objectUrlsRef = useRef<string[]>([]);

  const lf_revokeObjectUrls = () => {
    lv_objectUrlsRef.current.forEach((p_url) => {
      URL.revokeObjectURL(p_url);
    });
    lv_objectUrlsRef.current = [];
  };

  useEffect(() => {
    return () => {
      lf_revokeObjectUrls();
    };
  }, []);

  const lf_applyFiles = (p_files: File[]) => {
    lf_revokeObjectUrls();

    const lv_imageFiles = p_files.filter(gf_isImageFile);
    if (lv_imageFiles.length === 0) {
      setImages([]);
      setStatusMessage("선택된 이미지가 없습니다. png/jpg/webp 등의 파일을 선택해주세요.");
      return;
    }

    const lv_nextImages = lv_imageFiles.map((p_file, p_index) => {
      const lv_url = URL.createObjectURL(p_file);
      lv_objectUrlsRef.current.push(lv_url);

      return {
        id: `test_image_${p_index}_${p_file.name}_${p_file.lastModified}`,
        src: lv_url,
        relativePath: p_file.name,
      } satisfies BoundingBoxWorkspaceModuleImage;
    });

    setImages(lv_nextImages);
    setStatusMessage(`props 이미지 ${lv_nextImages.length}개를 모듈에 전달했습니다.`);
  };

  const lf_handleFileInputChange = (p_event: React.ChangeEvent<HTMLInputElement>) => {
    lf_applyFiles(Array.from(p_event.currentTarget.files || []));
    p_event.currentTarget.value = "";
  };

  const lf_clearImages = () => {
    lf_revokeObjectUrls();
    setImages([]);
    setStatusMessage("디버깅용 이미지 목록을 비웠습니다.");
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
            <input type="file" accept="image/*" multiple onChange={lf_handleFileInputChange} />
            이미지 선택
          </label>
          <button type="button" onClick={lf_clearImages} disabled={lv_images.length === 0}>
            선택 초기화
          </button>
          <span className="bbox-module-test__meta">현재 props 이미지: {lv_images.length}개</span>
        </div>

        {lv_images.length > 0 && (
          <ul className="bbox-module-test__image-list">
            {lv_images.map((p_image, p_index) => {
              if (typeof p_image === "string") {
                return <li key={`${p_image}_${p_index}`}>{p_image}</li>;
              }

              return <li key={p_image.id || `${p_image.src}_${p_index}`}>{p_image.relativePath || p_image.src}</li>;
            })}
          </ul>
        )}
      </section>

      <div className="bbox-module-test__workspace">
        <BoundingBoxWorkspaceModule p_images={lv_images} />
      </div>
    </section>
  );
}
