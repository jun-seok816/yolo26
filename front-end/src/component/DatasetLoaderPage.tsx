import React, { useState } from "react";
import "./DatasetLoaderPage.scss";
import { Main } from "@jsLib/class/Main";
import { Upload } from "@jsLib/class/Upload";
import UploadArea from "./UploadArea";
import BoundingBoxWorkspace from "./BoundingBoxWorkspace";

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
  lv_Obj.im_Prepare_Hooks();

  lv_Obj.im_UnMounted(() => {
    lv_Obj.pt_upload.im_dispose();
  });

  return (
    <div className="dataset-loader">
      <aside className="dataset-loader__aside">
        <UploadArea p_upload={lv_Obj.pt_upload} />
      </aside>
      <main className="dataset-loader__main">
        <BoundingBoxWorkspace />
      </main>
    </div>
  );
}
