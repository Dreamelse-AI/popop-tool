import { createBrowserRouter } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { TextLayoutPage } from '@/pages/TextLayoutPage';
import { BackgroundPage } from '@/pages/BackgroundPage';

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/tools/text-layout', element: <TextLayoutPage /> },
  { path: '/tools/background', element: <BackgroundPage /> },
]);
