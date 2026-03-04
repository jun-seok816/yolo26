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
  lv_Obj.im_Prepare_Hooks();

  lv_Obj.im_UnMounted(() => {
    lv_Obj.pt_upload.im_dispose();
  });

  return (
    <div className="dataset-loader">
      <UploadArea p_upload={lv_Obj.pt_upload} />
    </div>
  );
}
