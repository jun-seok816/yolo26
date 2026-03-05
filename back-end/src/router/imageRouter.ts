import { Request, Response, Router } from "express";
import fs from "fs";
import path from "path";

const imageRouter = Router();

const IMAGE_ROOT_DIR = path.resolve(__dirname, "../../assets/images");
const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".svg",
  ".ico",
]);

const gf_resolveSafeImagePath = (p_relativePath: string): string | null => {
  const lv_normalizedRelativePath = path.posix.normalize(p_relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  if (!lv_normalizedRelativePath || lv_normalizedRelativePath === ".") return null;

  const lv_absoluteFilePath = path.resolve(IMAGE_ROOT_DIR, lv_normalizedRelativePath);
  const lv_isInsideImageRoot =
    lv_absoluteFilePath === IMAGE_ROOT_DIR ||
    lv_absoluteFilePath.startsWith(`${IMAGE_ROOT_DIR}${path.sep}`);

  if (!lv_isInsideImageRoot) return null;
  return lv_absoluteFilePath;
};

const gf_hasAllowedExtension = (p_filePath: string): boolean => {
  return ALLOWED_IMAGE_EXTENSIONS.has(path.extname(p_filePath).toLowerCase());
};

const gf_collectImageRelativePaths = (p_rootDir: string, p_relativeDir: string = ""): string[] => {
  const lv_scanDir = path.resolve(p_rootDir, p_relativeDir);
  const lv_entries = fs.readdirSync(lv_scanDir, { withFileTypes: true });

  return lv_entries.flatMap((p_entry) => {
    const lv_nextRelativePath = path.posix.join(p_relativeDir, p_entry.name);

    if (p_entry.isDirectory()) {
      return gf_collectImageRelativePaths(p_rootDir, lv_nextRelativePath);
    }

    if (!p_entry.isFile() || !gf_hasAllowedExtension(p_entry.name)) {
      return [];
    }

    return [lv_nextRelativePath.replace(/\\/g, "/")];
  });
};

/**
 * GET /images/list
 * 이미지 루트 폴더(back-end/assets/images) 하위의 파일 경로 목록을 반환한다.
 */
imageRouter.get("/list", (_req: Request, res: Response): void => {
  try {
    const lv_images = gf_collectImageRelativePaths(IMAGE_ROOT_DIR).sort((p_a, p_b) =>
      p_a.localeCompare(p_b)
    );

    res.json({
      err: false,
      images: lv_images,
    });
  } catch (p_error) {
    console.error("[imageRouter] failed to scan image list:", p_error);
    res.status(500).json({
      err: true,
      msg: "이미지 목록을 불러오지 못했습니다.",
      images: [],
    });
  }
});

/**
 * GET /images/* 형태로 정적 이미지 파일을 응답한다.
 * 예) /images/icons/001.png -> back-end/assets/images/icons/001.png
 */
imageRouter.get("/*", (req: Request, res: Response): void => {
  const lv_requestedPath = req.params[0] || "";
  const lv_filePath = gf_resolveSafeImagePath(lv_requestedPath);

  if (!lv_filePath || !gf_hasAllowedExtension(lv_filePath)) {
    res.status(400).json({ err: true, msg: "유효하지 않은 이미지 경로입니다." });
    return;
  }

  if (!fs.existsSync(lv_filePath)) {
    res.status(404).json({ err: true, msg: "이미지 파일을 찾을 수 없습니다." });
    return;
  }

  res.sendFile(lv_filePath);
});

export default imageRouter;
