import { createBrowserRouter } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { TextLayoutPage } from '@/pages/TextLayoutPage';
import { BackgroundPage } from '@/pages/BackgroundPage';
import { VisualAssetPage } from '@/pages/VisualAssetPage';
import { MoodPicGalleryPage } from '@/pages/MoodPicGalleryPage';
import { StickerPage } from '@/pages/StickerPage';

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/tools/text-layout', element: <TextLayoutPage /> },
  { path: '/tools/background', element: <BackgroundPage /> },
  { path: '/tools/visual-asset', element: <VisualAssetPage /> },
  { path: '/tools/visual-asset/gallery', element: <MoodPicGalleryPage /> },
  { path: '/tools/sticker', element: <StickerPage /> },
]);
