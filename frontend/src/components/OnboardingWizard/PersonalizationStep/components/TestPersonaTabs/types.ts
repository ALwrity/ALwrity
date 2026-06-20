/**
 * Shared types for the Test Drive tabs.
 */

export type TestDrivePlatform =
  | 'blog'
  | 'podcast'
  | 'youtube'
  | 'instagram'
  | 'linkedin'
  | 'twitter';

export interface TestDriveImageResult {
  platform: TestDrivePlatform;
  imageUrl: string; // data: URL ready for <img src=...>
  filename: string;
  prompt: string;
  createdAt: number;
}
