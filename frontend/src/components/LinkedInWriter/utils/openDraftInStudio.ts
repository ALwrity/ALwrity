/**
 * Open saved LinkedIn draft content in Studio with the correct editor format.
 */
import {
  getDraftAssetContent,
  getDraftContentType,
  type LinkedInDraftAsset,
} from "./linkedInDraftLibraryUtils";
import {
  dispatchLinkedInDraftUpdate,
  type LinkedInDraftContentType,
} from "./linkedInDraftContentTypeStorage";

export function openDraftContentInStudio(
  content: string,
  contentType?: LinkedInDraftContentType | null,
  onDone?: () => void,
): void {
  dispatchLinkedInDraftUpdate(content, contentType ?? undefined);
  onDone?.();
}

export function openDraftAssetInStudio(
  asset: LinkedInDraftAsset,
  onDone?: () => void,
  contentOverride?: string,
): void {
  const content = contentOverride ?? getDraftAssetContent(asset);
  openDraftContentInStudio(content, getDraftContentType(asset), onDone);
}
