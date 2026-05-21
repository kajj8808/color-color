import { getImageAverageColor } from "./utils/image";

async function demo() {
  const imageUrl =
    "https://i.scdn.co/image/ab67616d0000b27315b8cef21bf4482d56c15614";

  try {
    const hexColor = await getImageAverageColor(imageUrl);
    console.log(`avg color: ${hexColor}`);
  } catch (error) {
    console.error(`이미지를 처리하는 중 오류가 발생하엿습니다. ${error}`);
  }
}

demo();
