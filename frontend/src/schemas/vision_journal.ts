/** Vision journal / inspiration board entries (API `/vision-journal`). */

export type VisionJournalEntryType = "text" | "image";

export type VisionJournalEntryRead = {
  id: number;
  user_id: number;
  entry_type: VisionJournalEntryType;
  text_content: string | null;
  image_url: string | null;
  caption: string | null;
  position: number | null;
  created_at: string;
  updated_at: string;
};

export type VisionJournalImageUploadResponse = {
  url: string;
};
