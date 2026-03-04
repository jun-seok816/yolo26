import React, { useState } from "react";
import "./DatasetLoaderPage.scss";
import { Main } from "@jsLib/class/Main";
import { Upload } from "@jsLib/class/Upload";
import UploadArea from "./UploadArea";

class DataSet extends Main {
  public pt_upload: Upload;
  constructor() {
    super();
    this.pt_upload = new Upload(() => {
      this.im_forceRender();
    });
  }
}

export default function DatasetLoaderPage() {
  const [lv_Obj] = useState(() => new DataSet());
  const [lv_projectTitle, setProjectTitle] = useState("");
  const lv_canUpload = lv_projectTitle.trim().length > 0;
  lv_Obj.im_Prepare_Hooks();

  lv_Obj.im_UnMounted(() => {
    lv_Obj.pt_upload.im_dispose();
  });

  return (
    <div className="dataset-loader">
      <section className="dataset-loader__project-panel">
        <label className="dataset-loader__project-label" htmlFor="project-title-input">
          Project Title
        </label>
        <input
          id="project-title-input"
          className="dataset-loader__project-input"
          type="text"
          value={lv_projectTitle}
          onChange={(p_event) => setProjectTitle(p_event.currentTarget.value)}
          placeholder="예: YOLO26 라벨링 1차"
          maxLength={80}
        />
        <p className={`dataset-loader__project-guide ${lv_canUpload ? "is-ready" : "is-required"}`}>
          {lv_canUpload
            ? "프로젝트 제목이 확인되었습니다. 이제 업로드를 진행할 수 있습니다."
            : "업로드 전에 프로젝트 제목을 먼저 입력해주세요."}
        </p>
      </section>
      <UploadArea p_upload={lv_Obj.pt_upload} p_disabled={!lv_canUpload} />
    </div>
  );
}
