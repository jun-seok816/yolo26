# @junseok816/react-image-labeler

단일 이미지를 대상으로 바운딩 박스 라벨링을 수행할 수 있는 React 컴포넌트입니다.

## 설치

```bash
npm install @junseok816/react-image-labeler
```

앱에서 번들된 스타일시트를 한 번만 import 해주세요.

```ts
import "@junseok816/react-image-labeler/style.css";
```

## 사용 예시

```tsx
import { useMemo, useState } from "react";
import ImageLabeler, {
  type ImageLabelerBoxInput,
  type ImageLabelerChange,
} from "@junseok816/react-image-labeler";
import "@junseok816/react-image-labeler/style.css";

type Item = {
  id: string;
  src: string;
  name: string;
};

export default function Example({ images }: { images: Item[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [labelsByImage, setLabelsByImage] = useState<Record<string, ImageLabelerBoxInput[]>>({});
  const [categories, setCategories] = useState(["fish", "other"]);

  const currentImage = images[currentIndex] ?? null;
  const currentValue = useMemo(() => {
    if (!currentImage) return [];
    return labelsByImage[currentImage.id] ?? [];
  }, [currentImage, labelsByImage]);

  const handleChange = (next: ImageLabelerChange) => {
    if (!next.imageId) return;

    setCategories(next.categories);
    setLabelsByImage((prev) => ({
      ...prev,
      [next.imageId]: next.value.map((box) => ({
        id: box.id,
        label: box.label,
        x: box.pixel.x,
        y: box.pixel.y,
        w: box.pixel.w,
        h: box.pixel.h,
      })),
    }));
  };

  return (
    <ImageLabeler
      image={
        currentImage
          ? {
              id: currentImage.id,
              src: currentImage.src,
              name: currentImage.name,
            }
          : null
      }
      value={currentValue}
      categories={categories}
      onChange={handleChange}
      style={{ minHeight: 760 }}
    />
  );
}
```

## Props

- `image`: 현재 라벨링할 이미지입니다. 한 번에 한 장만 전달합니다.
- `value`: 현재 이미지에 대한 박스 목록입니다. 좌표는 px 기준입니다.
- `categories`: 선택 가능한 라벨 카테고리 목록입니다.
- `onChange`: 박스, 카테고리, 선택 상태가 바뀔 때 호출됩니다.
- `className`: 루트 요소에 추가할 선택적 className입니다.
- `style`: 루트 요소에 적용할 선택적 inline style입니다.

## onChange 반환값

- `image`: 현재 이미지 메타데이터
- `imageId`: 현재 이미지 ID
- `value`: `pixel` 좌표와 `normalized` 좌표를 함께 포함한 현재 이미지 박스 목록
- `categories`: 현재 카테고리 목록
- `selectedBoxId`: 선택된 박스 ID 또는 `null`
- `naturalSize`: 로드된 이미지의 원본 너비/높이

## 참고

- 여러 이미지를 다룰 경우 상위 앱이 현재 인덱스와 이미지별 라벨 상태를 관리하고, 이 컴포넌트에는 현재 이미지 한 장만 전달하는 방식이 적합합니다.
- 이 패키지는 데이터셋 페이지 이동, 저장, 서버 동기화 같은 외부 상태 관리는 직접 처리하지 않습니다.
- 현재 예시는 `@junseok816/react-image-labeler` 기준입니다. 다른 계정이나 이름으로 배포할 예정이면 `package.json`과 import 예시를 함께 수정하세요.
