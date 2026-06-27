import { createBrowserRouter } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { TextLayoutPage } from '@/pages/TextLayoutPage';
import { VisualAssetPage } from '@/pages/VisualAssetPage';
import { MoodPicGalleryPage } from '@/pages/MoodPicGalleryPage';
import { StickerPage } from '@/pages/StickerPage';
import { StylePromptPage } from '@/pages/StylePromptPage';
import { PalettePage } from '@/pages/PalettePage';
import { BatchNameImagePage } from '@/pages/BatchNameImagePage';
import { PromptExtractionPage } from '@/pages/PromptExtractionPage';
import { IpExtendPage } from '@/pages/IpExtendPage';
import { LayoutParamPage } from '@/pages/LayoutParamPage';

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/tools/text-layout', element: <TextLayoutPage /> },
  { path: '/tools/visual-asset', element: <VisualAssetPage /> },
  { path: '/tools/visual-asset/gallery', element: <MoodPicGalleryPage /> },
  { path: '/tools/sticker', element: <StickerPage /> },
  { path: '/tools/style-prompt', element: <StylePromptPage /> },
  { path: '/tools/palette', element: <PalettePage /> },
  { path: '/tools/batch-name-image', element: <BatchNameImagePage /> },
  { path: '/tools/prompt-extraction', element: <PromptExtractionPage /> },
  { path: '/tools/ip-extend', element: <IpExtendPage /> },
  { path: '/tools/layout-param', element: <LayoutParamPage /> },
]);
